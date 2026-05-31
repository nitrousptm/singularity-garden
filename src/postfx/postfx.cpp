#include "postfx/postfx.h"
#include <cstdio>

bool PostFX::init(int w, int h) {
    W = w; H = h;

    glGenVertexArrays(1, &emptyVAO);

    if (!prefilterShader.loadVF("shaders/common/fullscreen.vert", "shaders/postfx/bloom_prefilter.frag"))
        return false;
    if (!blurShader.loadVF("shaders/common/fullscreen.vert", "shaders/postfx/bloom_blur.frag"))
        return false;
    if (!compositeShader.loadVF("shaders/common/fullscreen.vert", "shaders/postfx/composite.frag"))
        return false;

    // Create bloom MIP chain FBOs (half resolution down)
    for (int i = 0; i < BLOOM_MIPS; i++) {
        int bw = glm::max(1, w >> (i + 1));
        int bh = glm::max(1, h >> (i + 1));
        std::vector<Attachment> att = {{ 0, GL_RGB16F, GL_RGB, GL_FLOAT }};
        if (!bloomDownFBO[i].create(bw, bh, att, false)) return false;
        if (!bloomUpFBO[i].create(bw, bh, att, false))   return false;
    }
    return true;
}

void PostFX::destroy() {
    if (emptyVAO) { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}

void PostFX::process(GLuint hdrTex, GLuint nextSceneTex,
                     float time, float beatStrength,
                     float holyShitPhase,
                     float transitionBlend, int transitionType) {
    // ---- Bloom prefilter ----
    bloomDownFBO[0].bind();
    glViewport(0, 0, bloomDownFBO[0].width, bloomDownFBO[0].height);
    prefilterShader.use();
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, hdrTex);
    prefilterShader.setInt("uHDRBuffer", 0);
    prefilterShader.setFloat("uThreshold", 0.8f);
    prefilterShader.setFloat("uKnee", 0.1f);
    drawFullscreen();

    // ---- Downsample chain ----
    for (int i = 1; i < BLOOM_MIPS; i++) {
        bloomDownFBO[i].bind();
        glViewport(0, 0, bloomDownFBO[i].width, bloomDownFBO[i].height);
        blurShader.use();
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, bloomDownFBO[i-1].colorAttachments[0].tex);
        blurShader.setInt("uInput", 0);
        blurShader.setVec2("uTexelSize", glm::vec2(1.0f / bloomDownFBO[i-1].width,
                                                    1.0f / bloomDownFBO[i-1].height));
        blurShader.setInt("uPass", 0);
        blurShader.setFloat("uRadius", 0.5f);
        drawFullscreen();
    }

    // ---- Upsample chain ----
    for (int i = BLOOM_MIPS - 2; i >= 0; i--) {
        bloomUpFBO[i].bind();
        glViewport(0, 0, bloomUpFBO[i].width, bloomUpFBO[i].height);
        blurShader.use();
        GLuint src = (i == BLOOM_MIPS - 2)
                   ? bloomDownFBO[BLOOM_MIPS-1].colorAttachments[0].tex
                   : bloomUpFBO[i+1].colorAttachments[0].tex;
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, src);
        blurShader.setInt("uInput", 0);
        blurShader.setVec2("uTexelSize", glm::vec2(1.0f / bloomDownFBO[i+1].width,
                                                    1.0f / bloomDownFBO[i+1].height));
        blurShader.setInt("uPass", 1);
        blurShader.setFloat("uRadius", 1.0f);
        drawFullscreen();
    }

    // ---- Final composite to default framebuffer ----
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glViewport(0, 0, W, H);
    compositeShader.use();
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, hdrTex);
    compositeShader.setInt("uScene", 0);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, bloomUpFBO[0].colorAttachments[0].tex);
    compositeShader.setInt("uBloom", 1);
    // Next scene texture für Transitions
    glActiveTexture(GL_TEXTURE2);
    GLuint nextTex = (nextSceneTex != 0) ? nextSceneTex : hdrTex;
    glBindTexture(GL_TEXTURE_2D, nextTex);
    compositeShader.setInt("uNextScene", 2);

    compositeShader.setFloat("uTime",             time);
    compositeShader.setFloat("uBloomStrength",    bloomStrength);
    compositeShader.setFloat("uExposure",         exposure);
    compositeShader.setFloat("uChromaticStr",     chromaticStr);
    compositeShader.setFloat("uVignetteStr",      vignetteStr);
    compositeShader.setFloat("uGrainStr",         grainStr);
    compositeShader.setFloat("uBeatStrength",     beatStrength);
    compositeShader.setFloat("uHolyShitPhase",    holyShitPhase);
    compositeShader.setFloat("uTransitionBlend",  transitionBlend);
    compositeShader.setInt  ("uTransitionType",   transitionType);
    drawFullscreen();
}
