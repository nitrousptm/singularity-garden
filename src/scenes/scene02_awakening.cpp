#include "scenes/scene02_awakening.h"
#include <cmath>

bool Scene02Awakening::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();
    if (!shader.loadVF("shaders/common/fullscreen.vert", "shaders/scenes/scene02_awakening.frag"))
        return false;
    initialized = true;
    return true;
}

void Scene02Awakening::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.82f + ctx.beatStrength * 0.18f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;
}

void Scene02Awakening::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    shader.use();
    shader.setFloat("uTime",          ctx.demoTime);
    shader.setFloat("uSceneTime",    ctx.sceneTime);
    shader.setFloat("uProgress",     ctx.progress);
    shader.setFloat("uBeatPhase",    ctx.beatPhase);
    shader.setFloat("uBarPhase",     ctx.barPhase);
    shader.setFloat("uBeatStrength", beatStrength);
    shader.setFloat("uHolyShitPhase", ctx.holyShitPhase);
    shader.setVec2 ("uResolution",   glm::vec2(W, H));
    drawFullscreen(shader);
}

void Scene02Awakening::destroy() {
    if (emptyVAO) { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
