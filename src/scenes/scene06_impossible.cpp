#include "scenes/scene06_impossible.h"

bool Scene06Impossible::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();
    if (!shader.loadVF("shaders/common/fullscreen.vert", "shaders/scenes/scene06_impossible.frag"))
        return false;
    initialized = true;
    return true;
}

void Scene06Impossible::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.85f + ctx.beatStrength * 0.15f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;
}

void Scene06Impossible::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    shader.use();
    shader.setFloat("uTime",         ctx.demoTime);
    shader.setFloat("uProgress",     ctx.progress);
    shader.setFloat("uBeatPhase",    ctx.beatPhase);
    shader.setFloat("uBeatStrength", beatStrength);
    shader.setVec2("uResolution",    glm::vec2(W, H));
    drawFullscreen(shader);
}

void Scene06Impossible::destroy() {
    if (emptyVAO) { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
