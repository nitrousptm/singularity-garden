#pragma once
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <vector>

struct CameraKeyframe {
    float t;
    glm::vec3 pos;
    glm::vec3 target;
    float fovY;
};

class Camera {
public:
    glm::vec3 pos    = {0, 0, 5};
    glm::vec3 target = {0, 0, 0};
    glm::vec3 up     = {0, 1, 0};
    float fovY = 60.0f;
    float nearZ = 0.1f;
    float farZ  = 2000.0f;
    int width = 1920, height = 1080;

    glm::mat4 view()       const { return glm::lookAt(pos, target, up); }
    glm::mat4 projection() const { return glm::perspective(glm::radians(fovY), (float)width/height, nearZ, farZ); }
    glm::vec3 forward()    const { return glm::normalize(target - pos); }

    // Catmull-Rom spline through keyframes
    void evalSpline(const std::vector<CameraKeyframe>& kf, float t);

    // Shake for bass-hit events
    void shake(float t, float intensity, float freq, float duration);
    void update(float dt);

private:
    glm::vec3 shakeOffset = {0,0,0};
    float shakeT = 0, shakeDur = 0, shakeIntensity = 0, shakeFreq = 0;
};
