#pragma once
#include "scene/scene.h"

class Scene04Fracture : public Scene {
public:
    bool init(int w, int h) override;
    void update(const SceneContext& ctx) override;
    void render(const SceneContext& ctx, const Framebuffer& hdrTarget) override;
    void destroy() override;

private:
    Shader     shader;
    Framebuffer feedbackFBO[2];
    int         feedbackIdx = 0;
    float       beatStrength = 0.0f;
};
