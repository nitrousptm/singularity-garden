#include "scenes/scene07_singularity.h"
#include <cstring>
#include <cmath>
#include <glm/gtc/matrix_transform.hpp>

struct ParticleGPU {
    glm::vec4 pos;   // xyz, w=life
    glm::vec4 vel;   // xyz, w=mass
    glm::vec4 col;   // rgb, a=size
};

static float fh(float x) {
    union { float f; uint32_t i; } u = {x};
    u.i ^= u.i >> 17; u.i *= 0xbf324c81u; u.i ^= u.i >> 11;
    return float(u.i) / 4294967296.0f;
}

void Scene07Singularity::initParticles() {
    std::vector<ParticleGPU> particles(PARTICLE_COUNT);

    for (int i = 0; i < PARTICLE_COUNT; i++) {
        float seed = float(i) * 0.000137f;
        float arm  = float(i % 2);
        float r    = sqrtf(fh(seed)) * 30.0f;
        float theta = r * 0.5f + arm * 3.14159f + fh(seed+1.0f) * 0.4f;
        float h     = (fh(seed+2.0f) - 0.5f) * expf(-r * 0.1f) * 2.0f;

        particles[i].pos = glm::vec4(cosf(theta)*r, h, sinf(theta)*r, fh(seed+3.0f)*5.0f+1.0f);
        float orbV = sqrtf(50.0f / fmaxf(r, 0.1f)) * 0.8f;
        particles[i].vel = glm::vec4(-sinf(theta)*orbV, 0.0f, cosf(theta)*orbV, 1.0f);

        float cr = r / 30.0f;
        glm::vec3 cCore(0.6f, 0.8f, 1.0f);
        glm::vec3 cMid(1.0f, 0.7f, 0.3f);
        glm::vec3 cEdge(0.8f, 0.2f, 0.1f);
        glm::vec3 col = glm::mix(glm::mix(cCore, cMid, cr), cEdge, cr*cr);
        particles[i].col = glm::vec4(col, 0.0015f + 0.002f * (1.0f - cr));
    }

    glGenBuffers(1, &particleSSBO);
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, particleSSBO);
    glBufferData(GL_SHADER_STORAGE_BUFFER, PARTICLE_COUNT * sizeof(ParticleGPU),
                 particles.data(), GL_DYNAMIC_DRAW);
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

    // VAO for rendering (no vertex data, uses SSBO in vertex shader)
    glGenVertexArrays(1, &particleVAO);
}

bool Scene07Singularity::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();

    if (!nebulaShader.loadVF("shaders/common/fullscreen.vert", "shaders/scenes/scene07_nebula.frag"))
        return false;
    if (!particleShader.loadVF("shaders/scenes/scene07_singularity.vert",
                                "shaders/scenes/scene07_singularity.frag"))
        return false;
    if (!computeShader.loadCompute("shaders/particles/particles_update.comp"))
        return false;

    initParticles();
    initialized = true;
    return true;
}

void Scene07Singularity::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.88f + ctx.beatStrength * 0.12f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;

    // Mode transitions over scene progress
    if      (ctx.progress < 0.35f) mode = 0;  // galaxy
    else if (ctx.progress < 0.70f) mode = 1;  // nebula flow
    else                           mode = 2;  // singularity collapse
}

void Scene07Singularity::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    // --- Particle compute update ---
    computeShader.use();
    computeShader.setFloat("uTime",          ctx.demoTime);
    computeShader.setFloat("uDeltaTime",     ctx.dt);
    computeShader.setFloat("uProgress",      ctx.progress);
    computeShader.setInt("uMode",            mode);
    computeShader.setInt("uParticleCount",   PARTICLE_COUNT);
    computeShader.setFloat("uBeatStrength",  beatStrength);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, particleSSBO);
    glDispatchCompute((PARTICLE_COUNT + 255) / 256, 1, 1);
    glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT);

    // --- Render ---
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Background nebula
    nebulaShader.use();
    nebulaShader.setFloat("uTime",         ctx.demoTime);
    nebulaShader.setFloat("uProgress",     ctx.progress);
    nebulaShader.setFloat("uBeatPhase",    ctx.beatPhase);
    nebulaShader.setFloat("uBeatStrength", beatStrength);
    nebulaShader.setVec2("uResolution",    glm::vec2(W, H));
    glBindVertexArray(emptyVAO);
    glDrawArrays(GL_TRIANGLES, 0, 3);

    // Particle system (additive blending)
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    glEnable(GL_PROGRAM_POINT_SIZE);
    glDepthMask(GL_FALSE);

    Camera* cam = ctx.cam;
    glm::mat4 view = cam ? cam->view() : glm::lookAt(glm::vec3(0,20,60), glm::vec3(0), glm::vec3(0,1,0));
    glm::mat4 proj = cam ? cam->projection() : glm::perspective(glm::radians(60.0f), (float)W/H, 0.1f, 2000.0f);

    particleShader.use();
    particleShader.setMat4("uView",       view);
    particleShader.setMat4("uProj",       proj);
    particleShader.setFloat("uTime",      ctx.demoTime);
    particleShader.setFloat("uProgress",  ctx.progress);
    particleShader.setFloat("uBeatPhase", ctx.beatPhase);
    particleShader.setFloat("uBeatStrength", beatStrength);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, particleSSBO);
    glBindVertexArray(particleVAO);
    glDrawArrays(GL_POINTS, 0, PARTICLE_COUNT);
    glBindVertexArray(0);

    glDepthMask(GL_TRUE);
    glDisable(GL_BLEND);
    glDisable(GL_PROGRAM_POINT_SIZE);
}

void Scene07Singularity::destroy() {
    if (particleSSBO) { glDeleteBuffers(1, &particleSSBO); particleSSBO = 0; }
    if (particleVAO)  { glDeleteVertexArrays(1, &particleVAO); particleVAO = 0; }
    if (emptyVAO)     { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
