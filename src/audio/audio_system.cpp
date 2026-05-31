#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"
#include "audio/audio_system.h"
#include <cstdio>
#include <cmath>
#include <cstring>
#include <new>

AudioSystem::~AudioSystem() {
    stop();
    if (sound)  { ma_sound_uninit((ma_sound*)sound);  delete (ma_sound*)sound; }
    if (engine) { ma_engine_uninit((ma_engine*)engine); delete (ma_engine*)engine; }
}

bool AudioSystem::init(const std::string& wavPath, float bpmVal) {
    bpm = bpmVal;

    engine = (ma_engine*)(new ma_engine());
    memset(engine, 0, sizeof(ma_engine));
    ma_result result = ma_engine_init(nullptr, (ma_engine*)engine);
    if (result != MA_SUCCESS) {
        fprintf(stderr, "[Audio] Failed to init engine: %d\n", result);
        delete (ma_engine*)engine; engine = nullptr;
        return false;
    }

    sound = (ma_sound*)(new ma_sound());
    memset(sound, 0, sizeof(ma_sound));
    result = ma_sound_init_from_file((ma_engine*)engine, wavPath.c_str(),
                                     MA_SOUND_FLAG_DECODE, nullptr, nullptr, (ma_sound*)sound);
    if (result != MA_SUCCESS) {
        fprintf(stderr, "[Audio] Failed to load: %s (%d)\n", wavPath.c_str(), result);
        delete (ma_sound*)sound; sound = nullptr;
        return false;
    }

    printf("[Audio] Loaded: %s @ %.1f BPM\n", wavPath.c_str(), bpm);
    return true;
}

void AudioSystem::play() {
    if (!sound) return;
    ma_sound_start((ma_sound*)sound);
    playing = true;
    startTime = 0.0f;
    lastBeat = -1;
}

void AudioSystem::stop() {
    if (!sound) return;
    ma_sound_stop((ma_sound*)sound);
    playing = false;
}

float AudioSystem::getTime() const {
    if (!sound || !playing) return 0.0f;
    float cursor = 0.0f;
    ma_sound_get_cursor_in_seconds((ma_sound*)sound, &cursor);
    return cursor;
}

float AudioSystem::getBeatPhase() const {
    float beatLen = 60.0f / bpm;
    float t = getTime();
    return fmodf(t, beatLen) / beatLen;
}

float AudioSystem::getBarPhase() const {
    float barLen = 4.0f * 60.0f / bpm;
    float t = getTime();
    return fmodf(t, barLen) / barLen;
}

int AudioSystem::getCurrentBeat() const {
    float beatLen = 60.0f / bpm;
    return (int)(getTime() / beatLen);
}

void AudioSystem::update(float demoTime) {
    (void)demoTime;
    if (!playing || !beatCb) return;
    int beat = getCurrentBeat();
    if (beat != lastBeat && beat >= 0) {
        lastBeat = beat;
        BeatEvent e;
        e.beat = beat;
        e.bar  = beat / 4;
        e.time = beat * (60.0f / bpm);
        e.strength = (beat % 4 == 0) ? 1.0f : (beat % 2 == 0) ? 0.6f : 0.3f;
        beatCb(e);
    }
}
