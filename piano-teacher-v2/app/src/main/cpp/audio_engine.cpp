#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <vector>
#include <map>
#include <mutex>
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
};

static const int MAX_VOICES = 16;
// Release multiplier per-sample: ~80ms at 48kHz (0.9997^3840 ≈ 0.316)
static const float RELEASE_PER_SAMPLE = 0.9997f;

struct Voice {
    int pitch = -1;
    int sampleMidi = -1;  // index into mSamples
    double pos = 0.0;     // playback position in frames
    double rate = 1.0;    // combined pitch-shift + sampleRate-conversion ratio
    float amplitude = 0.8f;
    float releaseMult = 1.0f;
    bool active = false;
    bool releasing = false;
};

// ─── AudioEngine ─────────────────────────────────────────────────────────────

class AudioEngine : public oboe::AudioStreamDataCallback {
public:
    std::map<int, SampleData> mSamples;  // midiNote → SampleData
    std::mutex mSampleMutex;
    bool mReady = false;

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream,
        void* audioData,
        int32_t numFrames
    ) override {
        auto* out = static_cast<float*>(audioData);
        // Clear output buffer
        std::fill(out, out + numFrames * 2, 0.0f);

        if (!mReady) return oboe::DataCallbackResult::Continue;

        // Always acquire sampleMutex BEFORE voiceMutex (same order as noteOn) to avoid ABBA deadlock
        std::lock_guard<std::mutex> sLock(mSampleMutex);
        std::lock_guard<std::mutex> lock(mVoiceMutex);

        for (int vi = 0; vi < MAX_VOICES; vi++) {
            Voice& v = mVoices[vi];
            if (!v.active) continue;

            auto it = mSamples.find(v.sampleMidi);
            if (it == mSamples.end()) { v.active = false; continue; }
            const SampleData& s = it->second;

            int totalFrames = (int)(s.pcm.size() / s.channels);

            for (int f = 0; f < numFrames; f++) {
                int idx = (int)v.pos;
                if (idx >= totalFrames - 1) { v.active = false; break; }

                float frac = (float)(v.pos - idx);

                float left, right;
                if (s.channels >= 2) {
                    int i0 = idx * 2;
                    left  = s.pcm[i0]   * (1.0f - frac) + s.pcm[i0 + 2] * frac;
                    right = s.pcm[i0+1] * (1.0f - frac) + s.pcm[i0 + 3] * frac;
                } else {
                    float val = s.pcm[idx] * (1.0f - frac) + s.pcm[idx + 1] * frac;
                    left = right = val;
                }

                float gain = v.amplitude * v.releaseMult;
                out[f * 2]     = std::clamp(out[f * 2]     + left  * gain, -1.0f, 1.0f);
                out[f * 2 + 1] = std::clamp(out[f * 2 + 1] + right * gain, -1.0f, 1.0f);

                if (v.releasing) {
                    v.releaseMult *= RELEASE_PER_SAMPLE;
                    if (v.releaseMult < 0.001f) { v.active = false; break; }
                }

                v.pos += v.rate;
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
               ->setDataCallback(this);

        auto result = builder.openStream(mStream);
        if (result != oboe::Result::OK) {
            LOGE("Failed to open stream: %s", oboe::convertToText(result));
            return false;
        }

        mOutputSampleRate = mStream->getSampleRate();
        LOGI("Oboe stream opened: SR=%d", mOutputSampleRate);

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
        if (pitch < 0) {  // -1 = stop all
            std::lock_guard<std::mutex> lock(mVoiceMutex);
            for (auto& v : mVoices) v.active = false;
            return;
        }

        std::lock_guard<std::mutex> sLock(mSampleMutex);
        int nearestMidi = findNearestSample(pitch);
        if (nearestMidi < 0) return;
        const SampleData& s = mSamples[nearestMidi];

        // rate = pitch_shift × sample_rate_correction
        double pitchShift = std::pow(2.0, (pitch - nearestMidi) / 12.0);
        double srCorrection = (double)s.sampleRate / (double)mOutputSampleRate;
        double rate = pitchShift * srCorrection;

        std::lock_guard<std::mutex> vLock(mVoiceMutex);

        // Steal oldest voice if all busy, or reuse existing voice for pitch
        int slot = -1;
        for (int i = 0; i < MAX_VOICES; i++) {
            if (mVoices[i].pitch == pitch) { slot = i; break; }
        }
        if (slot < 0) {
            for (int i = 0; i < MAX_VOICES; i++) {
                if (!mVoices[i].active) { slot = i; break; }
            }
        }
        if (slot < 0) slot = mNextVoice++ % MAX_VOICES;  // steal

        Voice& v = mVoices[slot];
        v.pitch = pitch;
        v.sampleMidi = nearestMidi;
        v.pos = 0.0;
        v.rate = rate;
        v.amplitude = (velocity / 127.0f) * 0.85f;
        v.releaseMult = 1.0f;
        v.active = true;
        v.releasing = false;
    }

    void noteOff(int pitch) {
        if (pitch < 0) {  // -1 = release all
            std::lock_guard<std::mutex> lock(mVoiceMutex);
            for (auto& v : mVoices) {
                if (v.active && !v.releasing) { v.releasing = true; }
            }
            return;
        }
        std::lock_guard<std::mutex> lock(mVoiceMutex);
        for (auto& v : mVoices) {
            if (v.active && v.pitch == pitch && !v.releasing) {
                v.releasing = true;
            }
        }
    }

private:
    std::shared_ptr<oboe::AudioStream> mStream;
    Voice mVoices[MAX_VOICES] = {};
    std::mutex mVoiceMutex;
    int mOutputSampleRate = 48000;
    int mNextVoice = 0;

    int findNearestSample(int pitch) const {
        if (mSamples.empty()) return -1;
        int best = -1, bestDist = 999;
        for (auto& kv : mSamples) {
            int dist = std::abs(kv.first - pitch);
            if (dist < bestDist) { bestDist = dist; best = kv.first; }
        }
        return best;
    }
};

// ─── Global instance ──────────────────────────────────────────────────────────

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

    SampleData sample;
    sample.midiNote = midiNote;
    sample.sampleRate = sampleRate;
    sample.channels = channels;
    sample.pcm.assign(raw, raw + len);

    env->ReleaseFloatArrayElements(pcmData, raw, JNI_ABORT);

    std::lock_guard<std::mutex> lock(gEngine->mSampleMutex);
    gEngine->mSamples[midiNote] = std::move(sample);
    LOGI("Loaded sample midi=%d, frames=%d, SR=%d, ch=%d", midiNote, (int)(len/channels), sampleRate, channels);
}

JNIEXPORT void JNICALL
Java_com_tobietheunknown_pianoteacher_audio_AudioEngine_nativeSetReady(JNIEnv*, jobject) {
    if (gEngine) {
        gEngine->mReady = true;
        LOGI("Sampler ready, %d samples loaded", (int)gEngine->mSamples.size());
    }
}

} // extern "C"
