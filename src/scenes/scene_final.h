#pragma once
#include "scene/scene.h"

class SceneFinal : public Scene {
public:
    bool init(int w, int h) override;
    void update(const SceneContext& ctx) override;
    void render(const SceneContext& ctx, const Framebuffer& hdrTarget) override;
    void destroy() override;

    // Feed the last rendered frame from previous scene
    void setPrevSceneTexture(GLuint tex) { prevTex = tex; }

private:
    Shader shader;
    GLuint prevTex = 0;
};
