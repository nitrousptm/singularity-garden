#pragma once
#include <string>
#include <functional>
#include <vector>

// Forward declare miniaudio types to avoid including the huge header here
struct ma_engine;
struct ma_sound;

struct BeatEvent {
    float time;         // seconds from demo start
    int   beat;         // beat index
    int   bar;          // bar index
    float strength;     // 0-1 (downbeat = 1.0, upbeat = 0.5)
};

class AudioSystem {
public:
    AudioSystem() = default;
    ~AudioSystem();

    bool init(const std::string& wavPath, float bpm = 133.0f);
    void play();
    void stop();

    // Returns current playback position in seconds
    float getTime() const;

    // Beat sync: returns current beat phase [0,1)
    float getBeatPhase() const;
    float getBarPhase() const;   // 4/4 bar
    int   getCurrentBeat() const;

    // Manual event poll
    using BeatCallback = std::function<void(const BeatEvent&)>;
    void setBeatCallback(BeatCallback cb) { beatCb = cb; }
    void update(float demoTime);

    float bpm = 133.0f;
    bool  playing = false;

private:
    ma_engine* engine = nullptr;
    ma_sound*  sound  = nullptr;
    float      startTime = 0.0f;
    int        lastBeat  = -1;
    BeatCallback beatCb;

    void* engineMem = nullptr;
    void* soundMem  = nullptr;
};
