#include "scenes/scene_final.h"

bool SceneFinal::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();
    if (!shader.loadVF("shaders/common/fullscreen.vert", "shaders/scenes/scene_final.frag"))
        return false;
    initialized = true;
    return true;
}

void SceneFinal::update(const SceneContext& ctx) { (void)ctx; }

void SceneFinal::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glClear(GL_COLOR_BUFFER_BIT);
    shader.use();
    shader.setFloat("uTime",      ctx.demoTime);
    shader.setFloat("uProgress",  ctx.progress);
    shader.setFloat("uBeatPhase", ctx.beatPhase);
    shader.setVec2("uResolution", glm::vec2(W, H));

    if (prevTex) {
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, prevTex);
        shader.setInt("uPrevScene", 0);
    }
    drawFullscreen(shader);
}

void SceneFinal::destroy() {
    if (emptyVAO) { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
