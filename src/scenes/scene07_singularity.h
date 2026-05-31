#pragma once
#include "scene/scene.h"

class Scene07Singularity : public Scene {
public:
    static constexpr int PARTICLE_COUNT = 2'000'000;

    bool init(int w, int h) override;
    void update(const SceneContext& ctx) override;
    void render(const SceneContext& ctx, const Framebuffer& hdrTarget) override;
    void destroy() override;

private:
    Shader  nebulaShader;    // background nebula / galaxy
    Shader  particleShader;  // point sprite particles
    Shader  computeShader;   // particle simulation

    GLuint  particleSSBO = 0;
    GLuint  particleVAO  = 0;

    float   beatStrength = 0.0f;
    int     mode = 0;       // 0=galaxy, 1=nebula_flow, 2=collapse

    void initParticles();
};
