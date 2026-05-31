#include "core/camera.h"
#include <cmath>

static glm::vec3 catmullRom(const glm::vec3& p0, const glm::vec3& p1,
                             const glm::vec3& p2, const glm::vec3& p3, float t) {
    float t2 = t*t, t3 = t2*t;
    return 0.5f * ((2.0f*p1) +
                   (-p0+p2)*t +
                   (2.0f*p0-5.0f*p1+4.0f*p2-p3)*t2 +
                   (-p0+3.0f*p1-3.0f*p2+p3)*t3);
}

void Camera::evalSpline(const std::vector<CameraKeyframe>& kf, float t) {
    if (kf.empty()) return;
    if (kf.size() == 1) { pos = kf[0].pos; target = kf[0].target; fovY = kf[0].fovY; return; }

    // find segment
    int n = (int)kf.size();
    int seg = 0;
    for (int i = 0; i < n-1; ++i) {
        if (t >= kf[i].t && t <= kf[i+1].t) { seg = i; break; }
        seg = n-2;
    }
    float tStart = kf[seg].t, tEnd = kf[seg+1].t;
    float s = (tEnd > tStart) ? (t - tStart) / (tEnd - tStart) : 0.0f;
    s = glm::clamp(s, 0.0f, 1.0f);

    int i0 = glm::max(seg-1, 0);
    int i1 = seg;
    int i2 = glm::min(seg+1, n-1);
    int i3 = glm::min(seg+2, n-1);

    pos    = catmullRom(kf[i0].pos,    kf[i1].pos,    kf[i2].pos,    kf[i3].pos,    s);
    target = catmullRom(kf[i0].target, kf[i1].target, kf[i2].target, kf[i3].target, s);
    fovY   = glm::mix(kf[i1].fovY, kf[i2].fovY, s);
}

void Camera::shake(float t, float intensity, float freq, float duration) {
    shakeT = t; shakeIntensity = intensity; shakeFreq = freq; shakeDur = duration;
}

void Camera::update(float dt) {
    (void)dt;
    if (shakeIntensity > 0.0f && shakeDur > 0.0f) {
        float decay = 1.0f - glm::clamp(shakeT / shakeDur, 0.0f, 1.0f);
        float a = shakeIntensity * decay;
        shakeOffset = glm::vec3(
            a * sinf(shakeT * shakeFreq * 6.28f + 1.0f),
            a * sinf(shakeT * shakeFreq * 6.28f + 2.5f),
            0.0f);
        shakeT += dt;
    } else {
        shakeOffset = {0,0,0};
    }
    // apply shake to position perpendicular to view
    // (applied externally via pos + right * shakeOffset.x + up * shakeOffset.y)
}
