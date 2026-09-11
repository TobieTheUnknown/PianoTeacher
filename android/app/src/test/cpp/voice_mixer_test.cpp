#include "voice_mixer.h"
#include <array>
#include <atomic>
#include <cassert>
#include <condition_variable>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <new>
#include <thread>

static thread_local bool rendering = false;
void* operator new(std::size_t size) {
    assert(!rendering && "audio rendering allocated");
    if (void* result = std::malloc(size)) return result;
    throw std::bad_alloc();
}
void operator delete(void* value) noexcept { std::free(value); }
void* operator new[](std::size_t size) { return ::operator new(size); }
void operator delete[](void* value) noexcept { ::operator delete(value); }

using namespace piano;
static std::array<float, 4096> sample;
static VoiceCommand on(int64_t id, int pitch = 60) {
    return VoiceCommand::noteOn(id, pitch, 60, 1.0, 0.1f);
}
template<std::size_t N> static float render(VoiceMixer<N>& mixer, int frames = 8) {
    std::array<float, 128> output{};
    rendering = true;
    mixer.render(output.data(), frames, 48000, 0.5f, [](int) {
        return SampleView{sample.data(), static_cast<int>(sample.size()), 1};
    });
    rendering = false;
    float sum = 0;
    for (int i = 0; i < frames * 2; ++i) sum += output[i];
    return sum;
}
template<std::size_t N> static const Voice* voice(const VoiceMixer<N>& mixer, int64_t id) {
    for (const auto& v : mixer.voices()) if (v.active && v.id == id) return &v;
    return nullptr;
}

static void orderAndOwnership() {
    VoiceMixer<> mixer;
    assert(mixer.submit(on(1)));
    assert(mixer.submit(VoiceCommand::noteOff(1)));
    assert(mixer.submit(on(2))); // Equal pitch, different occurrence.
    render(mixer, 1);
    assert(voice(mixer, 1)->releasing);
    assert(!voice(mixer, 2)->releasing);
    assert(voice(mixer, 1)->releaseMult < voice(mixer, 2)->releaseMult);
    render(mixer, 32);
    assert(!voice(mixer, 1));
    assert(voice(mixer, 2));
    mixer.submit(VoiceCommand::noteOff(3));
    mixer.submit(on(3)); // An off before its on cannot release the later attack.
    render(mixer);
    assert(!voice(mixer, 3)->releasing);
}

static void stealing() {
    VoiceMixer<> mixer;
    for (int id = 1; id <= 65; ++id) assert(mixer.submit(on(id)));
    render(mixer);
    assert(!voice(mixer, 1));
    assert(voice(mixer, 65));
    mixer.submit(VoiceCommand::noteOff(1));
    render(mixer);
    assert(!voice(mixer, 65)->releasing);
    mixer.submit(VoiceCommand::noteOff(2));
    render(mixer, 1);
    mixer.submit(on(66));
    render(mixer, 1);
    assert(!voice(mixer, 2)); // Prefer the quiet releasing slot to a held voice.
    assert(voice(mixer, 65) && voice(mixer, 66));
}

static void saturationAndRestart() {
    VoiceMixer<4> mixer;
    mixer.submit(on(1));
    assert(render(mixer) > 0);
    for (int id = 2; id <= 5; ++id) assert(mixer.submit(on(id)));
    assert(!mixer.submit(VoiceCommand::noteOff(1))); // Lost off becomes a panic purge.
    assert(render(mixer) == 0);
    for (int id = 1; id <= 5; ++id) assert(!voice(mixer, id));
    mixer.submit(on(6));
    assert(render(mixer) > 0);
    mixer.submit(VoiceCommand::click(true, 0.5f));
    mixer.submit(on(7));
    mixer.invalidate(); // Stream stopped: old pending commands cannot survive restart.
    assert(render(mixer) == 0);
    mixer.submit(on(8));
    assert(render(mixer) > 0);
    assert(!voice(mixer, 6) && !voice(mixer, 7) && voice(mixer, 8));
    mixer.submit(VoiceCommand::noteOff(7)); // An old handle cannot stop the new generation.
    render(mixer);
    assert(!voice(mixer, 8)->releasing);
    mixer.invalidate();
    mixer.invalidate();
    assert(render(mixer) == 0);
    // Multiple physical ring wraps, including reset with a full ring.
    for (int lap = 0; lap < 1000; ++lap) {
        for (int id = 1; id <= 4; ++id) assert(mixer.submit(on(id)));
        mixer.invalidate();
        assert(render(mixer) == 0);
    }
}

static void suspendedProducer() {
    VoiceMixer<> mixer;
    mixer.submit(on(1));
    assert(render(mixer) > 0);
    std::mutex producerMutex; // The JNI producer lock is never shared with render.
    std::mutex gateMutex;
    std::condition_variable gate;
    bool holding = false, resume = false;
    std::thread producer([&] {
        std::lock_guard<std::mutex> producerLock(producerMutex);
        std::unique_lock<std::mutex> lock(gateMutex);
        holding = true;
        gate.notify_one();
        gate.wait(lock, [&] { return resume; });
        mixer.submit(VoiceCommand::noteOff(1));
    });
    {
        std::unique_lock<std::mutex> lock(gateMutex);
        gate.wait(lock, [&] { return holding; });
    }
    assert(render(mixer) > 0); // Must finish before the producer is allowed to resume.
    {
        std::lock_guard<std::mutex> lock(gateMutex);
        resume = true;
    }
    gate.notify_one();
    producer.join();
    render(mixer, 32);
    assert(!voice(mixer, 1));
}

static void invalidationDuringRender() {
    VoiceMixer<> mixer;
    mixer.submit(on(1));
    std::array<float, 16> output{};
    // The sample lookup gives an exact interleaving within a render, without sleeps.
    rendering = true;
    mixer.render(output.data(), 8, 48000, 0.5f, [&](int) {
        mixer.invalidate();
        mixer.submit(on(2));
        return SampleView{sample.data(), static_cast<int>(sample.size()), 1};
    });
    rendering = false;
    for (float value : output) assert(value == 0);
    assert(!voice(mixer, 1));
    assert(render(mixer) > 0 && voice(mixer, 2));
    mixer.invalidate();
    mixer.submit(VoiceCommand::click(true, 0.5f));
    assert(render(mixer) > 0);
    mixer.invalidate();
    assert(render(mixer) == 0); // An already sounding click is purged too.
}

static void concurrentStress() {
    VoiceMixer<16> mixer;
    std::atomic<bool> finished{false};
    std::thread producer([&] {
        for (int id = 1; id <= 100000; ++id) {
            mixer.submit(on(id));
            mixer.submit(VoiceCommand::noteOff(id));
            if (id % 71 == 0) mixer.invalidate();
        }
        mixer.invalidate();
        finished.store(true, std::memory_order_release);
    });
    while (!finished.load(std::memory_order_acquire)) render(mixer);
    producer.join();
    assert(render(mixer) == 0);
}

static void stereoInterpolationAndSampleEnd() {
    VoiceMixer<> mixer;
    const std::array<float, 6> pcm{0.2f, -0.2f, 0.6f, -0.6f, 1.0f, -1.0f};
    std::array<float, 10> output{};
    mixer.submit(VoiceCommand::noteOn(1, 60, 60, 0.5, 0.5f));
    rendering = true;
    mixer.render(output.data(), 5, 48000, 0.5f, [&](int) {
        return SampleView{pcm.data(), 3, 2};
    });
    rendering = false;
    for (int frame = 0; frame < 4; ++frame) {
        assert(std::abs(output[frame * 2] - 0.1f * (frame + 1)) < 0.000001f);
        assert(std::abs(output[frame * 2 + 1] + output[frame * 2]) < 0.000001f);
    }
    assert(output[8] == 0 && output[9] == 0);
    assert(!voice(mixer, 1));
}

int main() {
    sample.fill(0.5f);
    orderAndOwnership();
    stealing();
    saturationAndRestart();
    suspendedProducer();
    invalidationDuringRender();
    concurrentStress();
    stereoInterpolationAndSampleEnd();
    std::cout << "voice_mixer: 7 test groups passed\n";
}
