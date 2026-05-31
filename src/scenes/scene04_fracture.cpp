#include "scenes/scene04_fracture.h"

bool Scene04Fracture::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();
    if (!shader.loadVF("shaders/common/fullscreen.vert", "shaders/scenes/scene04_fracture.frag"))
        return false;

    // Create feedback framebuffers
    std::vector<Attachment> att = {{ 0, GL_RGB16F, GL_RGB, GL_FLOAT }};
    for (int i = 0; i < 2; i++) {
        att[0].tex = 0;
        if (!feedbackFBO[i].create(w, h, att, false)) return false;
    }
    initialized = true;
    return true;
}

void Scene04Fracture::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.85f + ctx.beatStrength * 0.15f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;
}

void Scene04Fracture::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    // Render to feedback buffer
    int write = feedbackIdx;
    int read  = 1 - feedbackIdx;

    feedbackFBO[write].bind();
    glViewport(0, 0, W, H);
    shader.use();
    shader.setFloat("uTime",         ctx.demoTime);
    shader.setFloat("uProgress",     ctx.progress);
    shader.setFloat("uBeatPhase",    ctx.beatPhase);
    shader.setFloat("uBeatStrength", beatStrength);
    shader.setVec2("uResolution",    glm::vec2(W, H));
    // Bind previous frame as feedback texture
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, feedbackFBO[read].colorAttachments[0].tex);
    shader.setInt("uPrevFrame", 0);
    drawFullscreen(shader);

    // Copy to HDR target
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glBindFramebuffer(GL_READ_FRAMEBUFFER, feedbackFBO[write].fbo);
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, hdrTarget.fbo);
    glBlitFramebuffer(0, 0, W, H, 0, 0, W, H, GL_COLOR_BUFFER_BIT, GL_LINEAR);

    feedbackIdx = 1 - feedbackIdx;
}

void Scene04Fracture::destroy() {
    if (emptyVAO) { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
