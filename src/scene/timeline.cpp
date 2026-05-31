#include "scene/timeline.h"
#include <cmath>
#include <algorithm>

void Timeline::buildTimeline() {
    scenes = {
        { 0.0f,  20.0f, "BOOT",            0 },
        { 20.0f, 45.0f, "AWAKENING_CORE",  1 },
        { 45.0f, 75.0f, "CITY_CORRUPTION", 2 },
        { 75.0f, 105.0f,"TIME_FRACTURE",   3 },
        {105.0f, 150.0f,"GEOMETRY_BLOOM",  4 },
        {150.0f, 180.0f,"IMPOSSIBLE_SPACE",5 },
        {180.0f, 230.0f,"SINGULARITY_GARDEN",6},
        {230.0f, 240.0f,"FINAL_ASCENSION", 7 },
    };
}

int Timeline::getScene(float t, float& progress) const {
    for (auto& s : scenes) {
        if (t >= s.startTime && t < s.endTime) {
            float dur = s.endTime - s.startTime;
            progress = (t - s.startTime) / dur;
            return s.id;
        }
    }
    progress = 1.0f;
    return scenes.back().id;
}

int Timeline::getSceneIndex(float t) const {
    float progress;
    return getScene(t, progress);
}

bool Timeline::isBarStart(float t, float dt) const {
    int prevBar = (int)((t - dt) / BAR);
    int curBar  = (int)(t / BAR);
    return curBar != prevBar;
}

float Timeline::getTransitionBlend(float t, float blendDur) const {
    for (int i = 0; i < (int)scenes.size() - 1; i++) {
        float end = scenes[i].endTime;
        float d = t - end;
        if (d >= -blendDur * 0.5f && d <= blendDur * 0.5f) {
            return (d + blendDur * 0.5f) / blendDur;
        }
    }
    return -1.0f;  // not in transition
}
