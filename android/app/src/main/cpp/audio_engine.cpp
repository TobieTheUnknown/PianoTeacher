#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <vector>
#include <mutex>
#include <atomic>
#include <cmath>
#include <algorithm>
#include <memory>
#include "voice_mixer.h"

#define LOG_TAG "PianoAudio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ─── Data structures ──────────────────────────────────────────────────────────

struct SampleData {
    std::vector<float> pcm;  // interleaved (stereo or mono)
    int sampleRate = 44100;
    int channels = 2;
    int midiNote = 69;
    int totalFrames = 0;     // cached: pcm.size() / channels (avoids per-callback divide)
};

static const int MIDI_RANGE = 128;
// Release multiplier per-sample: default ~720ms decay to silence (0.001 threshold)
static std::atomic<float> gReleasePer{0.9998f};
static_assert(std::atomic<float>::is_always_lock_free);
static_assert(std::atomic<bool>::is_always_lock_free);

// ─── AudioEngine ─────────────────────────────────────────────────────────────

class AudioEngine : public oboe::AudioStreamDataCallback, public oboe::AudioStreamErrorCallback {
public:
    // Sample storage indexed by MIDI note 0..127. nullptr = no sample loaded.
    // Owned via unique_ptr; raw pointers below are non-owning views.
    std::unique_ptr<SampleData> mSampleByMidi[MIDI_RANGE];
    // Pre-computed nearest-sample LUT. mNearestForPitch[p] = MIDI note of the
    // loaded sample closest to pitch `p`, or -1 if none loaded. Built once in
    // setReady() then read-only — no lock needed in the audio callback.
    int mNearestForPitch[MIDI_RANGE];

    // mReady gates the audio callback's voice loop and noteOn. Published with
    // release semantics from the loader thread after all samples are written,
    // observed with acquire semantics by the audio + UI threads. This piggy-
    // backs as a memory barrier so the mSampleByMidi array is safely visible.
    std::atomic<bool> mReady{false};

    AudioEngine(JNIEnv* env, jobject owner) {
        for (int i = 0; i < MIDI_RANGE; i++) mNearestForPitch[i] = -1;
        env->GetJavaVM(&mJavaVm);
        mJavaOwner = env->NewGlobalRef(owner);
        const jclass ownerClass = env->GetObjectClass(owner);
        mInterruptedMethod = env->GetMethodID(ownerClass, "onNativeOutputInterrupted", "()V");
        env->DeleteLocalRef(ownerClass);
    }

    ~AudioEngine() override {
        JNIEnv* env = nullptr;
        const bool attach = mJavaVm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_EDETACHED;
        if (attach && mJavaVm->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
        env->DeleteGlobalRef(mJavaOwner);
        if (attach) mJavaVm->DetachCurrentThread();
    }

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* /*stream*/,
        void* audioData,
        int32_t numFrames
    ) override {
        auto* out = static_cast<float*>(audioData);
        if (!mReady.load(std::memory_order_acquire)) {
            std::fill(out, out + numFrames * 2, 0.0f);
            return oboe::DataCallbackResult::Continue;
        }

        mMixer.render(out, numFrames, mOutputSampleRate,
            gReleasePer.load(std::memory_order_relaxed), [this](int midi) {
                const auto* sample = mSampleByMidi[midi].get();
                return sample
                    ? piano::SampleView{sample->pcm.data(), sample->totalFrames, sample->channels}
                    : piano::SampleView{};
            });

        return oboe::DataCallbackResult::Continue;
    }

    bool start() {
        std::lock_guard<std::mutex> streamLock(mStreamMutex);
        if (isRunningLocked()) return true;
        // The error callback can arrive after a MIDI action notices Disconnected.
        // Record that loss before replacing the old stream, even if onError is late.
        if (mStream) markInterruptedLocked();
        closeStreamLocked();
        oboe::AudioStreamBuilder builder;
        builder.setDirection(oboe::Direction::Output)
               ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
               ->setSharingMode(oboe::SharingMode::Exclusive)
               ->setFormat(oboe::AudioFormat::Float)
               ->setChannelCount(2)
               ->setUsage(oboe::Usage::Media)
               ->setContentType(oboe::ContentType::Music)
               ->setDataCallback(this)
               ->setErrorCallback(this);

        auto result = builder.openStream(mStream);
        if (result != oboe::Result::OK) {
            LOGE("Failed to open stream: %s", oboe::convertToText(result));
            return false;
        }

        mOutputSampleRate = mStream->getSampleRate();
        mStreamInterrupted = false;
        // Set buffer size to 2× burst for stable underrun protection without
        // significant latency increase. Burst is typically 96 frames @48kHz (2ms).
        int32_t burst = mStream->getFramesPerBurst();
        if (burst > 0) mStream->setBufferSizeInFrames(burst * 2);

        LOGI("Oboe stream opened: SR=%d, burst=%d", mOutputSampleRate, burst);

        result = mStream->requestStart();
        if (result != oboe::Result::OK) {
            LOGE("Failed to start stream: %s", oboe::convertToText(result));
            closeStreamLocked();
            return false;
        }

        LOGI("Audio engine started (Oboe, Salamander sampler)");
        return true;
    }

    void stop() {
        std::lock_guard<std::mutex> streamLock(mStreamMutex);
        closeStreamLocked();
    }

    bool onError(oboe::AudioStream* stream, oboe::Result error) override {
        // Oboe invokes this on its error thread, never the realtime callback.
        // Own closing here so lifecycle/start cannot race Oboe's default close.
        {
            std::lock_guard<std::mutex> streamLock(mStreamMutex);
            if (!mStream || mStream.get() != stream) return true; // Already closed by lifecycle.
            markInterruptedLocked();
            LOGE("Oboe output interrupted: %s", oboe::convertToText(error));
            stream->stop();
            stream->close();
        }
        // Never enter Kotlin while holding mStreamMutex: Kotlin may be waiting in
        // nativeStart/nativeSuspend with its voice lock held. Notification only
        // reconciles the revision, so an already handled, late callback is harmless.
        notifyOutputInterrupted();
        // Keep the shared owner alive until the next explicit start/stop. Samples
        // and their immutable lookup table survive output device replacement.
        return true;
    }

    int64_t outputRevision() const {
        return mOutputRevision.load(std::memory_order_acquire);
    }

    void noteOn(int64_t id, int pitch, int velocity) {
        // Serialize producers only. The audio callback never takes this lock.
        std::lock_guard<std::mutex> commandLock(mCommandMutex);
        if (pitch < 0) { mMixer.invalidate(); return; }
        if (!mReady.load(std::memory_order_acquire) || pitch >= MIDI_RANGE) return;
        const int nearestMidi = mNearestForPitch[pitch];
        if (nearestMidi < 0) return;
        const SampleData* sample = mSampleByMidi[nearestMidi].get();
        if (!sample) return;
        const double pitchShift = std::pow(2.0, (pitch - nearestMidi) / 12.0);
        const double rate = pitchShift * sample->sampleRate / mOutputSampleRate;
        mMixer.submit(piano::VoiceCommand::noteOn(
            id, pitch, nearestMidi, rate, (velocity / 127.0f) * 0.85f));
    }

    void noteOff(int64_t id) {
        std::lock_guard<std::mutex> commandLock(mCommandMutex);
        mMixer.submit(piano::VoiceCommand::noteOff(id));
    }

    void playClick(bool accent, float amplitude) {
        std::lock_guard<std::mutex> commandLock(mCommandMutex);
        mMixer.submit(piano::VoiceCommand::click(accent, amplitude));
    }

    // Called from the loader thread (UI) for each sample. Not lock-free, but
    // it only runs during init; the audio callback bails out via !mReady.
    void loadSample(int midiNote, const float* pcm, int len, int sampleRate, int channels) {
        if (midiNote < 0 || midiNote >= MIDI_RANGE || sampleRate <= 0 || (channels != 1 && channels != 2) || len < channels * 2) return;
        auto s = std::make_unique<SampleData>();
        s->midiNote = midiNote;
        s->sampleRate = sampleRate;
        s->channels = channels;
        s->pcm.assign(pcm, pcm + len);
        s->totalFrames = len / channels;
        mSampleByMidi[midiNote] = std::move(s);
    }

    // Builds the pitch → nearest-loaded-sample LUT and publishes mReady.
    // After this returns, mSampleByMidi is read-only and visible to the audio
    // thread without locking (memory_order_release on mReady).
    void setReady() {
        int loaded = 0;
        for (int p = 0; p < MIDI_RANGE; p++) {
            int best = -1, bestDist = 9999;
            for (int q = 0; q < MIDI_RANGE; q++) {
                if (!mSampleByMidi[q]) continue;
                int dist = std::abs(q - p);
                if (dist < bestDist) { bestDist = dist; best = q; }
            }
            mNearestForPitch[p] = best;
        }
        for (int q = 0; q < MIDI_RANGE; q++) if (mSampleByMidi[q]) loaded++;
        mReady.store(true, std::memory_order_release);
        LOGI("Sampler ready, %d samples loaded", loaded);
    }

    int mOutputSampleRate = 48000;

private:
    void markInterruptedLocked() {
        if (!mStreamInterrupted) {
            mStreamInterrupted = true;
            mOutputRevision.fetch_add(1, std::memory_order_release);
        }
    }

    void notifyOutputInterrupted() {
        JNIEnv* env = nullptr;
        const bool attach = mJavaVm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_EDETACHED;
        if (attach && mJavaVm->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
        env->CallVoidMethod(mJavaOwner, mInterruptedMethod);
        if (env->ExceptionCheck()) {
            // Keep the native error thread usable; the revision is still reconciled
            // synchronously before the next Kotlin action if notification fails.
            LOGE("Kotlin output interruption notification failed");
            env->ExceptionClear();
        }
        if (attach) mJavaVm->DetachCurrentThread();
    }

    bool isRunningLocked() const {
        if (!mStream) return false;
        const auto state = mStream->getState();
        return state == oboe::StreamState::Started || state == oboe::StreamState::Starting;
    }

    void closeStreamLocked() {
        if (mStream) {
            if (mStream->getState() != oboe::StreamState::Closed) {
                mStream->stop();
                mStream->close();
            }
            mStream.reset();
        }
        // Publish a new command generation. Voice/click state remains audio-owned;
        // the next callback discards pre-close commands before producing sound.
        std::lock_guard<std::mutex> commandLock(mCommandMutex);
        mMixer.invalidate();
    }

    std::shared_ptr<oboe::AudioStream> mStream;
    std::mutex mStreamMutex;
    piano::VoiceMixer<> mMixer;
    std::mutex mCommandMutex;
    JavaVM* mJavaVm = nullptr;
    jobject mJavaOwner = nullptr;
    jmethodID mInterruptedMethod = nullptr;
    std::atomic<int64_t> mOutputRevision{0};
    bool mStreamInterrupted = false; // mStreamMutex only
};

// ─── Global instance ─────────────────────────────────────────────────────────

static AudioEngine* gEngine = nullptr;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeInitialize(JNIEnv* env, jobject owner) {
    if (!gEngine) gEngine = new AudioEngine(env, owner);
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeStart(JNIEnv*, jobject) {
    if (!gEngine) return JNI_FALSE;
    return gEngine->start() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jlong JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeOutputRevision(JNIEnv*, jobject) {
    return gEngine ? gEngine->outputRevision() : 0;
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeSuspend(JNIEnv*, jobject) {
    if (gEngine) gEngine->stop();
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeSilence(JNIEnv*, jobject) {
    // Panic is only a command generation change: never wait for the stream mutex.
    if (gEngine) gEngine->noteOn(0, -1, 0);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeStop(JNIEnv*, jobject) {
    if (gEngine) { gEngine->stop(); delete gEngine; gEngine = nullptr; }
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativePlayVoice(JNIEnv*, jobject, jlong id, jint pitch, jint velocity) {
    if (gEngine) gEngine->noteOn(id, pitch, velocity);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeStopVoice(JNIEnv*, jobject, jlong id) {
    if (gEngine) gEngine->noteOff(id);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeLoadSample(
    JNIEnv* env, jobject, jint midiNote, jfloatArray pcmData, jint sampleRate, jint channels)
{
    if (!gEngine) return;

    jsize len = env->GetArrayLength(pcmData);
    jfloat* raw = env->GetFloatArrayElements(pcmData, nullptr);

    gEngine->loadSample(midiNote, raw, len, sampleRate, channels);
    env->ReleaseFloatArrayElements(pcmData, raw, JNI_ABORT);

    LOGI("Loaded sample midi=%d, frames=%d, SR=%d, ch=%d",
         midiNote, (int)(len / channels), sampleRate, channels);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeSetReady(JNIEnv*, jobject) {
    if (gEngine) gEngine->setReady();
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeSetRelease(
    JNIEnv* /*env*/, jobject /*thiz*/, jfloat releasePer) {
    gReleasePer.store(releasePer, std::memory_order_relaxed);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativePlayClick(
    JNIEnv* /*env*/, jobject /*thiz*/, jboolean isAccent, jfloat amplitude) {
    if (gEngine) gEngine->playClick(isAccent, amplitude);
}

} // extern "C"
