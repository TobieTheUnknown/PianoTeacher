#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <vector>
#include <map>
#include <mutex>
#include <cmath>

#define LOG_TAG "PianoAudio"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static const int SAMPLE_RATE = 48000;
static const int CHANNEL_COUNT = 2;

// Simple sine-wave voice for testing (will be replaced by Salamander sampler)
struct Voice {
    int pitch = 0;
    float phase = 0.0f;
    float amplitude = 0.0f;
    bool active = false;

    float frequency() const {
        return 440.0f * std::pow(2.0f, (pitch - 69) / 12.0f);
    }
};

class AudioEngine : public oboe::AudioStreamDataCallback {
public:
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream,
        void* audioData,
        int32_t numFrames
    ) override {
        auto* out = static_cast<float*>(audioData);
        std::lock_guard<std::mutex> lock(mMutex);

        for (int i = 0; i < numFrames; i++) {
            float sample = 0.0f;
            for (auto& voice : mVoices) {
                if (!voice.second.active) continue;
                float freq = voice.second.frequency();
                sample += voice.second.amplitude * std::sin(voice.second.phase);
                voice.second.phase += 2.0f * M_PI * freq / SAMPLE_RATE;
                if (voice.second.phase > 2.0f * M_PI) voice.second.phase -= 2.0f * M_PI;
            }
            // Stereo
            out[i * 2] = sample;
            out[i * 2 + 1] = sample;
        }
        return oboe::DataCallbackResult::Continue;
    }

    bool start() {
        oboe::AudioStreamBuilder builder;
        builder.setDirection(oboe::Direction::Output)
               ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
               ->setSharingMode(oboe::SharingMode::Exclusive)
               ->setFormat(oboe::AudioFormat::Float)
               ->setChannelCount(CHANNEL_COUNT)
               ->setSampleRate(SAMPLE_RATE)
               ->setDataCallback(this);

        auto result = builder.openStream(mStream);
        if (result != oboe::Result::OK) {
            LOGE("Failed to open stream: %s", oboe::convertToText(result));
            return false;
        }

        result = mStream->requestStart();
        if (result != oboe::Result::OK) {
            LOGE("Failed to start stream: %s", oboe::convertToText(result));
            return false;
        }

        LOGI("Audio engine started, latency: %d ms",
             mStream->getBufferSizeInFrames() * 1000 / SAMPLE_RATE);
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
        std::lock_guard<std::mutex> lock(mMutex);
        Voice& voice = mVoices[pitch];
        voice.pitch = pitch;
        voice.amplitude = velocity / 127.0f * 0.3f;
        voice.phase = 0.0f;
        voice.active = true;
    }

    void noteOff(int pitch) {
        std::lock_guard<std::mutex> lock(mMutex);
        if (mVoices.count(pitch)) {
            mVoices[pitch].active = false;
        }
    }

private:
    std::shared_ptr<oboe::AudioStream> mStream;
    std::map<int, Voice> mVoices;
    std::mutex mMutex;
};

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

} // extern "C"
