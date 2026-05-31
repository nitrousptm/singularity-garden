#pragma once
#include "core/shader.h"
#include "core/framebuffer.h"

// Full post-processing pipeline:
// HDR scene → bloom prefilter → 6x downsample/upsample → composite → display

class PostFX {
public:
    bool init(int w, int h);
    void destroy();

    // Process scene FBO → outputs to screen (default framebuffer = 0)
    // nextSceneTex: nächste Szene (für Transitions), kann 0 sein
    void process(GLuint hdrTex, GLuint nextSceneTex,
                 float time, float beatStrength,
                 float holyShitPhase,
                 float transitionBlend, int transitionType);

    // Settings
    float bloomStrength   = 0.9f;
    float exposure        = 1.2f;
    float chromaticStr    = 0.003f;
    float vignetteStr     = 0.3f;
    float grainStr        = 0.025f;

    // Dynamic per-scene settings
    void setExposure(float e)     { exposure = e; }
    void setBloom(float b)        { bloomStrength = b; }
    void setChromatic(float c)    { chromaticStr = c; }

private:
    int W = 1920, H = 1080;

    Shader prefilterShader;
    Shader blurShader;
    Shader compositeShader;

    static constexpr int BLOOM_MIPS = 6;
    Framebuffer bloomDownFBO[BLOOM_MIPS];
    Framebuffer bloomUpFBO[BLOOM_MIPS];

    GLuint emptyVAO = 0;

    void drawFullscreen() {
        glBindVertexArray(emptyVAO);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        glBindVertexArray(0);
    }
};
