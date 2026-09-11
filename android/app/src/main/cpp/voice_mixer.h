#pragma once

#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>

namespace piano {

struct SampleView {
    const float* pcm = nullptr;
    int frames = 0;
    int channels = 1;
};

struct Voice {
    int64_t id = 0;
    int pitch = -1;
    int sampleMidi = -1;
    double pos = 0.0;
    double rate = 1.0;
    float amplitude = 0.8f;
    float releaseMult = 1.0f;
    bool active = false;
    bool releasing = false;
};

struct VoiceCommand {
    enum class Kind { On, Off, Click };
    Kind kind = Kind::Off;
    Voice voice;
    static VoiceCommand noteOn(int64_t id, int pitch, int sample, double rate, float gain) {
        VoiceCommand command;
        command.kind = Kind::On;
        command.voice = {id, pitch, sample, 0.0, rate, gain, 1.0f, true, false};
        return command;
    }
    static VoiceCommand noteOff(int64_t id) {
        VoiceCommand command;
        command.voice.id = id;
        return command;
    }
    static VoiceCommand click(bool accent, float gain) {
        VoiceCommand command;
        command.kind = Kind::Click;
        command.voice.pitch = accent ? 880 : 440;
        command.voice.amplitude = std::clamp(gain, 0.0f, 1.0f);
        return command;
    }
};

/**
 * One serialized producer (JNI's command mutex), one consumer (Oboe callback).
 * Only render writes voices/click state. No mutex, allocation, retry loop or
 * producer-owned mutable object is accessed by render; samples are immutable.
 *
 * Overflow is a panic: reject the triggering command, advance the generation,
 * and silence all old voices/clicks plus discard old queued commands at the
 * next callback. Dropping a note-off can therefore never strand a held voice.
 * Attacks may be lost during overload; later commands use the new generation.
 * invalidate has the same policy and is also used while the stream is stopped.
 * Ring indices are never reset, so a queued command cannot reappear on restart.
 */
template<std::size_t Capacity = 256>
class VoiceMixer {
    static_assert(Capacity > 0 && (Capacity & (Capacity - 1)) == 0);
    static_assert(Capacity < (uint32_t{1} << 31));
    static_assert(std::atomic<uint32_t>::is_always_lock_free,
                  "The realtime command queue requires lock-free 32-bit atomics");
public:
    // Producer only; concurrent callers must serialize OUTSIDE the audio thread.
    bool submit(const VoiceCommand& command) {
        const uint32_t write = mWrite.load(std::memory_order_relaxed);
        const uint32_t read = mRead.load(std::memory_order_acquire);
        if (write - read == Capacity) {
            invalidate();
            return false;
        }
        mCommands[write % Capacity] = {command, mGeneration.load(std::memory_order_relaxed)};
        mWrite.store(write + 1, std::memory_order_release);
        return true;
    }

    void invalidate() {
        mGeneration.fetch_add(1, std::memory_order_release);
    }

    // Consumer only, including inspection by host tests between render calls.
    const std::array<Voice, 64>& voices() const { return mVoices; }

    template<class SampleLookup>
    void render(float* output, int frames, int sampleRate, float releasePer, SampleLookup sampleFor) {
        std::fill(output, output + frames * 2, 0.0f);
        synchronizeGeneration();
        uint32_t read = mRead.load(std::memory_order_relaxed);
        // A fixed snapshot bounds this work to Capacity, even under continuous MIDI.
        const uint32_t end = mWrite.load(std::memory_order_acquire);
        while (read != end) {
            const Entry entry = mCommands[read % Capacity];
            mRead.store(++read, std::memory_order_release);
            if (entry.generation == mAudioGeneration) apply(entry.command, sampleRate);
        }
        synchronizeGeneration();

        for (auto& voice : mVoices) {
            if (!voice.active) continue;
            const SampleView sample = sampleFor(voice.sampleMidi);
            if (!sample.pcm || sample.frames < 2) { voice.active = false; continue; }
            for (int frame = 0; frame < frames; ++frame) {
                const int index = static_cast<int>(voice.pos);
                if (index >= sample.frames - 1) { voice.active = false; break; }
                const float fraction = static_cast<float>(voice.pos - index);
                float left, right;
                if (sample.channels == 2) {
                    const int offset = index * 2;
                    left = sample.pcm[offset] * (1.0f - fraction) + sample.pcm[offset + 2] * fraction;
                    right = sample.pcm[offset + 1] * (1.0f - fraction) + sample.pcm[offset + 3] * fraction;
                } else {
                    left = right = sample.pcm[index] * (1.0f - fraction) + sample.pcm[index + 1] * fraction;
                }
                const float gain = voice.amplitude * voice.releaseMult;
                output[frame * 2] = std::clamp(output[frame * 2] + left * gain, -1.0f, 1.0f);
                output[frame * 2 + 1] = std::clamp(output[frame * 2 + 1] + right * gain, -1.0f, 1.0f);
                if (voice.releasing) {
                    voice.releaseMult *= releasePer;
                    if (voice.releaseMult < 0.001f) { voice.active = false; break; }
                }
                voice.pos += voice.rate;
            }
        }

        for (int frame = 0; frame < frames && mClickPosition < mClickFrames; ++frame) {
            const int attack = mClickFrames / 6;
            const int decay = mClickFrames - attack;
            const float envelope = mClickPosition < attack
                ? static_cast<float>(mClickPosition) / attack
                : 1.0f - static_cast<float>(mClickPosition - attack) / decay;
            const float time = static_cast<float>(mClickPosition++) / sampleRate;
            const float click = mClickGain * envelope * static_cast<float>(
                std::sin(2.0 * 3.14159265358979323846 * mClickFrequency * time));
            output[frame * 2] = std::clamp(output[frame * 2] + click, -1.0f, 1.0f);
            output[frame * 2 + 1] = std::clamp(output[frame * 2 + 1] + click, -1.0f, 1.0f);
        }
        // An overflow/reset during mixing must also silence the buffer just built.
        if (synchronizeGeneration()) std::fill(output, output + frames * 2, 0.0f);
    }

private:
    struct Entry { VoiceCommand command; uint32_t generation = 0; };
    std::array<Entry, Capacity> mCommands{};
    std::atomic<uint32_t> mWrite{0};
    std::atomic<uint32_t> mRead{0};
    std::atomic<uint32_t> mGeneration{0};
    uint32_t mAudioGeneration = 0;
    std::array<Voice, 64> mVoices{};
    std::size_t mNextVoice = 0;
    int mClickPosition = 0;
    int mClickFrames = 0;
    int mClickFrequency = 440;
    float mClickGain = 0;

    bool synchronizeGeneration() {
        const uint32_t generation = mGeneration.load(std::memory_order_acquire);
        if (generation == mAudioGeneration) return false;
        mAudioGeneration = generation;
        for (auto& voice : mVoices) voice.active = false;
        mNextVoice = 0;
        mClickPosition = mClickFrames = 0;
        return true;
    }

    void apply(const VoiceCommand& command, int sampleRate) {
        if (command.kind == VoiceCommand::Kind::Off) {
            for (auto& voice : mVoices)
                if (voice.active && voice.id == command.voice.id) voice.releasing = true;
        } else if (command.kind == VoiceCommand::Kind::Click) {
            mClickPosition = 0;
            mClickFrames = sampleRate * 25 / 1000;
            mClickFrequency = command.voice.pitch;
            mClickGain = command.voice.amplitude;
        } else {
            Voice* slot = nullptr;
            for (auto& voice : mVoices) if (!voice.active) { slot = &voice; break; }
            if (!slot) {
                float quietest = 2.0f;
                for (auto& voice : mVoices) {
                    if (voice.releasing && voice.releaseMult < quietest) {
                        quietest = voice.releaseMult;
                        slot = &voice;
                    }
                }
            }
            if (!slot) slot = &mVoices[mNextVoice++ % mVoices.size()];
            *slot = command.voice;
        }
    }
};

} // namespace piano
