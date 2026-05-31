#pragma once
#include <vector>
#include <functional>
#include <string>

struct SceneEntry {
    float startTime;   // seconds
    float endTime;
    std::string name;
    int   id;
};

class Timeline {
public:
    static constexpr float DEMO_DURATION = 240.0f;  // 4 minutes
    static constexpr float BPM = 133.0f;
    static constexpr float BEAT = 60.0f / BPM;      // 0.45113s
    static constexpr float BAR  = BEAT * 4.0f;      // 1.80451s

    std::vector<SceneEntry> scenes;

    Timeline() { buildTimeline(); }

    // Returns scene ID at time t, and progress within that scene [0,1]
    int  getScene(float t, float& progress) const;
    int  getSceneIndex(float t) const;

    // BPM helpers
    float getBeatPhase(float t) const   { float p; std::modf(t / BEAT, &p); return t/BEAT - (int)(t/BEAT); }
    float getBarPhase(float t) const    { return std::fmod(t, BAR) / BAR; }
    int   getBeat(float t) const        { return (int)(t / BEAT); }
    int   getBar(float t) const         { return (int)(t / BAR); }
    bool  isBarStart(float t, float dt) const;

    // Transition blend: returns 0..1 for blend between scenes
    float getTransitionBlend(float t, float blendDur = 0.5f) const;

private:
    void buildTimeline();
};
