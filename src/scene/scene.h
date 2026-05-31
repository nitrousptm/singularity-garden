#pragma once
#include <glad/gl.h>
#include "core/shader.h"
#include "core/framebuffer.h"
#include "core/mesh.h"
#include "core/camera.h"
#include "audio/audio_system.h"

struct SceneContext {
    float demoTime;         // total demo time
    float sceneTime;        // time within current scene
    float progress;         // 0..1 within scene
    float dt;               // delta time
    float beatPhase;        // 0..1
    float barPhase;         // 0..1
    float beatStrength;     // 0..1
    float holyShitPhase;    // 0..1 — Klimax-Moment der Szene
    int   beat;
    int   bar;
    int   sceneID;          // 0-7
    int   width, height;
    Camera* cam;
};

class Scene {
public:
    virtual ~Scene() = default;

    virtual bool init(int width, int height)    = 0;
    virtual void update(const SceneContext& ctx) = 0;
    virtual void render(const SceneContext& ctx, const Framebuffer& hdrTarget) = 0;
    virtual void destroy()                       {}

    bool initialized = false;

protected:
    int  W = 1920, H = 1080;

    // Draws a fullscreen triangle
    void drawFullscreen(const Shader& sh) const {
        sh.use();
        glBindVertexArray(emptyVAO);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        glBindVertexArray(0);
    }

    void initFullscreenVAO() {
        glGenVertexArrays(1, &emptyVAO);
    }

    GLuint emptyVAO = 0;
};
