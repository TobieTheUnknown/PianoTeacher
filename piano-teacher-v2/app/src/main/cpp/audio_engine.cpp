#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <vector>
#include <mutex>
#include <atomic>
#include <cmath>
#include <algorithm>
#include <memory>

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

static const int MAX_VOICES = 64;
static const int MIDI_RANGE = 128;
// Release multiplier per-sample: default ~720ms decay to silence (0.001 threshold)
static std::atomic<float> gReleasePer{0.9998f};

// ─── Metronome click (synthesized in audio callback, zero Java overhead) ─────

struct ClickState {
    std::atomic<bool> active{false};
    int pos = 0;          // current sample position (audio-thread owned)
    int totalSamples = 0; // click duration in samples (audio-thread owned)
    double freq = 440.0;  // Hz (audio-thread owned)
    float amplitude = 0.45f;
};

static ClickState gClick;
static int gClickDurationMs = 25; // short click

struct Voice {
    int pitch = -1;
    int sampleMidi = -1;       // index into mSampleByMidi
    double pos = 0.0;          // playback position in frames
    double rate = 1.0;         // combined pitch-shift + sampleRate-conversion ratio
    float amplitude = 0.8f;
    float releaseMult = 1.0f;
    bool active = false;
    bool releasing = false;
};

// ─── AudioEngine ─────────────────────────────────────────────────────────────

class AudioEngine : public oboe::AudioStreamDataCallback {
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

    AudioEngine() {
        for (int i = 0; i < MIDI_RANGE; i++) mNearestForPitch[i] = -1;
    }

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* /*stream*/,
        void* audioData,
        int32_t numFrames
    ) override {
        auto* out = static_cast<float*>(audioData);
        // Clear output buffer (silence baseline)
        std::fill(out, out + numFrames * 2, 0.0f);

        if (!mReady.load(std::memory_order_acquire)) {
            return oboe::DataCallbackResult::Continue;
        }

        // Snapshot the release rate once per buffer (cheap, avoids re-reading).
        const float releasePer = gReleasePer.load(std::memory_order_relaxed);

        // Voice loop. After mReady=true, mSampleByMidi is read-only; we touch
        // it without locking. Voice fields are guarded by mVoiceMutex when
        // written from the UI thread; we use try_lock here so a contended UI
        // thread (e.g. a noteOn burst) can't stall the audio callback past its
        // deadline — at worst we skip voice rendering for this buffer (~2ms of
        // silence) instead of producing an underrun glitch.
        if (mVoiceMutex.try_lock()) {
            for (int vi = 0; vi < MAX_VOICES; vi++) {
                Voice& v = mVoices[vi];
                if (!v.active) continue;

                const SampleData* s = (v.sampleMidi >= 0 && v.sampleMidi < MIDI_RANGE)
                    ? mSampleByMidi[v.sampleMidi].get() : nullptr;
                if (!s) { v.active = false; continue; }

                const int totalFrames = s->totalFrames;
                const float* pcm = s->pcm.data();
                const int channels = s->channels;
                const float amp = v.amplitude;

                for (int f = 0; f < numFrames; f++) {
                    int idx = (int)v.pos;
                    if (idx >= totalFrames - 1) { v.active = false; break; }

                    float frac = (float)(v.pos - idx);

                    float left, right;
                    if (channels >= 2) {
                        int i0 = idx * 2;
                        left  = pcm[i0]     * (1.0f - frac) + pcm[i0 + 2] * frac;
                        right = pcm[i0 + 1] * (1.0f - frac) + pcm[i0 + 3] * frac;
                    } else {
                        float val = pcm[idx] * (1.0f - frac) + pcm[idx + 1] * frac;
                        left = right = val;
                    }

                    float gain = amp * v.releaseMult;
                    out[f * 2]     = std::clamp(out[f * 2]     + left  * gain, -1.0f, 1.0f);
                    out[f * 2 + 1] = std::clamp(out[f * 2 + 1] + right * gain, -1.0f, 1.0f);

                    if (v.releasing) {
                        v.releaseMult *= releasePer;
                        if (v.releaseMult < 0.001f) { v.active = false; break; }
                    }

                    v.pos += v.rate;
                }
            }
            mVoiceMutex.unlock();
        }

        // ─── Metronome click (mixed into output) ─────────────────────────────
        if (gClick.active.load(std::memory_order_acquire)) {
            const int sr = mOutputSampleRate;
            for (int f = 0; f < numFrames && gClick.pos < gClick.totalSamples; f++) {
                float t = (float)gClick.pos / (float)sr;
                float env;
                int attack = gClick.totalSamples / 6;
                int decay = gClick.totalSamples - attack;
                if (gClick.pos < attack) {
                    env = (float)gClick.pos / (float)attack;
                } else {
                    env = 1.0f - (float)(gClick.pos - attack) / (float)decay;
                }
                float sample = gClick.amplitude * env * (float)std::sin(2.0 * M_PI * gClick.freq * t);
                out[f * 2]     = std::clamp(out[f * 2]     + sample, -1.0f, 1.0f);
                out[f * 2 + 1] = std::clamp(out[f * 2 + 1] + sample, -1.0f, 1.0f);
                gClick.pos++;
            }
            if (gClick.pos >= gClick.totalSamples) {
                gClick.active.store(false, std::memory_order_release);
            }
        }

        return oboe::DataCallbackResult::Continue;
    }

    bool start() {
        oboe::AudioStreamBuilder builder;
        builder.setDirection(oboe::Direction::Output)
               ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
               ->setSharingMode(oboe::SharingMode::Exclusive)
               ->setFormat(oboe::AudioFormat::Float)
               ->setChannelCount(2)
               ->setUsage(oboe::Usage::Media)
               ->setContentType(oboe::ContentType::Music)
               ->setDataCallback(this);

        auto result = builder.openStream(mStream);
        if (result != oboe::Result::OK) {
            LOGE("Failed to open stream: %s", oboe::convertToText(result));
            return false;
        }

        mOutputSampleRate = mStream->getSampleRate();
        // Set buffer size to 2× burst for stable underrun protection without
        // significant latency increase. Burst is typically 96 frames @48kHz (2ms).
        int32_t burst = mStream->getFramesPerBurst();
        if (burst > 0) mStream->setBufferSizeInFrames(burst * 2);

        LOGI("Oboe stream opened: SR=%d, burst=%d", mOutputSampleRate, burst);

        result = mStream->requestStart();
        if (result != oboe::Result::OK) {
            LOGE("Failed to start stream: %s", oboe::convertToText(result));
            return false;
        }

        LOGI("Audio engine started (Oboe, Salamander sampler)");
        return true;
    }

    void stop() {
        if (mStream) {
            mStream->stop();
            mStream->close();
            mStream.reset();
        }
    }

    void noteOn(int pitch, int velocity) {
        if (pitch < 0) {  // -1 = stop all (instant; no release)
            std::lock_guard<std::mutex> lock(mVoiceMutex);
            for (auto& v : mVoices) v.active = false;
            return;
        }
        if (!mReady.load(std::memory_order_acquire)) return;
        if (pitch < 0 || pitch >= MIDI_RANGE) return;

        // O(1) sample lookup via precomputed LUT (built in setReady()).
        const int nearestMidi = mNearestForPitch[pitch];
        if (nearestMidi < 0) return;
        const SampleData* s = mSampleByMidi[nearestMidi].get();
        if (!s) return;

        // Compute rate outside the voice-mutex critical section.
        const double pitchShift = std::pow(2.0, (pitch - nearestMidi) / 12.0);
        const double srCorrection = (double)s->sampleRate / (double)mOutputSampleRate;
        const double rate = pitchShift * srCorrection;
        const float amplitude = (velocity / 127.0f) * 0.85f;

        std::lock_guard<std::mutex> vLock(mVoiceMutex);

        // Voice slot selection: reuse same-pitch voice → free voice → round-robin steal.
        // Prefer same-pitch reuse so retriggers don't accumulate orphaned voices.
        int slot = -1;
        for (int i = 0; i < MAX_VOICES; i++) {
            if (mVoices[i].pitch == pitch) { slot = i; break; }
        }
        if (slot < 0) {
            for (int i = 0; i < MAX_VOICES; i++) {
                if (!mVoices[i].active) { slot = i; break; }
            }
        }
        if (slot < 0) slot = mNextVoice++ % MAX_VOICES;  // steal (round-robin)

        Voice& v = mVoices[slot];
        v.pitch = pitch;
        v.sampleMidi = nearestMidi;
        v.pos = 0.0;
        v.rate = rate;
        v.amplitude = amplitude;
        v.releaseMult = 1.0f;
        v.releasing = false;
        v.active = true;
    }

    void noteOff(int pitch) {
        std::lock_guard<std::mutex> lock(mVoiceMutex);
        if (pitch < 0) {  // -1 = release all (lets them decay naturally)
            for (auto& v : mVoices) {
                if (v.active && !v.releasing) { v.releasing = true; }
            }
            return;
        }
        for (auto& v : mVoices) {
            if (v.active && v.pitch == pitch && !v.releasing) {
                v.releasing = true;
            }
        }
    }

    // Called from the loader thread (UI) for each sample. Not lock-free, but
    // it only runs during init; the audio callback bails out via !mReady.
    void loadSample(int midiNote, const float* pcm, int len, int sampleRate, int channels) {
        if (midiNote < 0 || midiNote >= MIDI_RANGE) return;
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
    std::shared_ptr<oboe::AudioStream> mStream;
    Voice mVoices[MAX_VOICES] = {};
    std::mutex mVoiceMutex;
    int mNextVoice = 0;
};

// ─── Global instance ─────────────────────────────────────────────────────────

static AudioEngine* gEngine = nullptr;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeStart(JNIEnv*, jobject) {
    if (!gEngine) gEngine = new AudioEngine();
    return gEngine->start() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeStop(JNIEnv*, jobject) {
    if (gEngine) { gEngine->stop(); delete gEngine; gEngine = nullptr; }
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeNoteOn(JNIEnv*, jobject, jint pitch, jint velocity) {
    if (gEngine) gEngine->noteOn(pitch, velocity);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeNoteOff(JNIEnv*, jobject, jint pitch) {
    if (gEngine) gEngine->noteOff(pitch);
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
    int sr = gEngine ? gEngine->mOutputSampleRate : 48000;
    gClick.freq = isAccent ? 880.0 : 440.0;
    gClick.amplitude = amplitude;
    gClick.totalSamples = sr * gClickDurationMs / 1000;
    gClick.pos = 0;
    gClick.active.store(true, std::memory_order_release);
}

} // extern "C"
