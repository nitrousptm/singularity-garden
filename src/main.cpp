// ============================================================
// SINGULARITY GARDEN
// PC Demo by agentix — Assembly Summer 2026, Helsinki
// OpenGL 4.6 Core | C++20 | 4:00 minutes @ 60fps
// Music: Concrete-Syncope @ 133 BPM
// ============================================================

#include <glad/gl.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <cstdio>
#include <cmath>
#include <memory>
#include <array>

#include "core/shader.h"
#include "core/framebuffer.h"
#include "core/mesh.h"
#include "core/camera.h"
#include "core/text.h"
#include "audio/audio_system.h"
#include "scene/timeline.h"
#include "scene/scene.h"
#include "scenes/scene01_boot.h"
#include "scenes/scene02_awakening.h"
#include "scenes/scene03_city.h"
#include "scenes/scene04_fracture.h"
#include "scenes/scene05_bloom.h"
#include "scenes/scene06_impossible.h"
#include "scenes/scene07_singularity.h"
#include "scenes/scene_final.h"
#include "postfx/postfx.h"

static constexpr int   W             = 1920;
static constexpr int   H             = 1080;
static constexpr float DEMO_DURATION = 240.0f;
static constexpr float BPM           = 133.0f;

// ---- Transition duration (seconds) between scenes ----
static constexpr float TRANSITION_DUR = 0.55f;

// ---- Holy-Shit window: starts at this progress fraction, ends at 1.0 ----
// Defines when each scene hits its climax (smooth 0→1 ramp)
static constexpr float HS_START[8] = {
    0.76f,   // 0 BOOT        — System fully online
    0.82f,   // 1 AWAKENING   — Monolith supernova
    0.80f,   // 2 CITY        — Simultane Kristallisierung
    0.74f,   // 3 FRACTURE    — Kaleidoskop maximum
    0.80f,   // 4 BLOOM       — Volle Fraktal-Blüte
    0.84f,   // 5 IMPOSSIBLE  — Mandelbulb infinite reveal
    0.76f,   // 6 SINGULARITY — Kollaps + Explosion
    0.45f,   // 7 FINAL       — Logo-Flash
};

// Transition type per outgoing scene (0..7 → enum in composite.frag)
// 0=Flash, 1=Swirl, 2=Shatter, 3=BloomBleed, 4=RadialZoom, 5=Implosion, 6=Supernova, 7=Crossfade
static constexpr int TRANSITION_TYPE[8] = {
    0,  // Boot     → Awakening  : Flash (energy burst)
    4,  // Awakening→ City       : Radial zoom (monolith → city)
    2,  // City     → Fracture   : Shatter dissolve
    3,  // Fracture → Bloom      : Bloom bleed
    4,  // Bloom    → Impossible : Radial zoom dive
    5,  // Impossible→Singularity: Implosion
    6,  // Singularity→ Final    : Supernova flash
    7,  // Final    → (end)      : Crossfade
};

// ---- Beat strength global ----
static float s_beatStrength = 0.0f;
static float s_beatDecay    = 5.0f;

// ---- Inline smoothstep for holy-shit phase ----
static float smoothstepf(float e0, float e1, float x) {
    float t = glm::clamp((x - e0) / (e1 - e0), 0.0f, 1.0f);
    return t * t * (3.0f - 2.0f * t);
}

int main(int, char**) {
    printf("╔══════════════════════════════════════╗\n");
    printf("║      SINGULARITY GARDEN              ║\n");
    printf("║      agentix — Assembly 2026         ║\n");
    printf("╚══════════════════════════════════════╝\n");

    if (!glfwInit()) { fprintf(stderr, "GLFW init failed\n"); return 1; }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);
    glfwWindowHint(GLFW_DOUBLEBUFFER, GLFW_TRUE);

#ifndef _DEBUG
    GLFWmonitor* monitor = glfwGetPrimaryMonitor();
    GLFWwindow*  window  = glfwCreateWindow(W, H, "SINGULARITY GARDEN", monitor, nullptr);
#else
    GLFWwindow* window = glfwCreateWindow(W, H, "SINGULARITY GARDEN [debug]", nullptr, nullptr);
#endif
    if (!window) { fprintf(stderr, "Window creation failed\n"); glfwTerminate(); return 1; }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    glfwSetKeyCallback(window, [](GLFWwindow* w, int key, int, int action, int) {
        if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
            glfwSetWindowShouldClose(w, 1);
    });

    int glVersion = gladLoadGL(glfwGetProcAddress);
    if (!glVersion) { fprintf(stderr, "Failed to load OpenGL\n"); return 1; }
    printf("[GL] OpenGL %d.%d — %s\n",
           GLAD_VERSION_MAJOR(glVersion), GLAD_VERSION_MINOR(glVersion),
           glGetString(GL_RENDERER));

    glEnable(GL_FRAMEBUFFER_SRGB);

    // ---- HDR FBOs: current scene + next scene (für Transitions) ----
    std::vector<Attachment> hdrAtt = {{ 0, GL_RGB16F, GL_RGB, GL_FLOAT }};
    Framebuffer hdrFBO, hdrNextFBO;
    if (!hdrFBO.create(W, H, hdrAtt, true))     { fprintf(stderr, "HDR FBO failed\n");      return 1; }
    if (!hdrNextFBO.create(W, H, hdrAtt, true)) { fprintf(stderr, "HDR Next FBO failed\n"); return 1; }

    // ---- Post-FX ----
    PostFX postfx;
    if (!postfx.init(W, H)) { fprintf(stderr, "PostFX init failed\n"); return 1; }

    // ---- Text Renderer ----
    TextRenderer textRenderer;
    if (!textRenderer.init(W, H)) { fprintf(stderr, "TextRenderer init failed\n"); return 1; }

    // ---- Audio ----
    AudioSystem audio;
    bool hasAudio = audio.init("assets/music/Concrete-Syncope.wav", BPM);
    audio.setBeatCallback([](const BeatEvent& e) {
        s_beatStrength = e.strength;
    });

    // ---- Timeline ----
    Timeline timeline;

    // ---- Camera ----
    Camera cam;
    cam.width = W; cam.height = H;
    cam.nearZ = 0.1f; cam.farZ = 2000.0f;

    // ---- Scenes ----
    std::array<std::unique_ptr<Scene>, 8> scenes;
    scenes[0] = std::make_unique<Scene01Boot>();
    scenes[1] = std::make_unique<Scene02Awakening>();
    scenes[2] = std::make_unique<Scene03City>();
    scenes[3] = std::make_unique<Scene04Fracture>();
    scenes[4] = std::make_unique<Scene05Bloom>();
    scenes[5] = std::make_unique<Scene06Impossible>();
    scenes[6] = std::make_unique<Scene07Singularity>();
    scenes[7] = std::make_unique<SceneFinal>();

    for (int i = 0; i < 8; i++) {
        if (!scenes[i]->init(W, H)) {
            fprintf(stderr, "[Scene %d] init failed\n", i);
            return 1;
        }
        printf("[Scene %d] init OK\n", i);
    }

    printf("[Demo] All systems go. Starting...\n\n");
    if (hasAudio) audio.play();

    // ---- Main loop ----
    double prevWallTime  = glfwGetTime();
    float  demoTime      = 0.0f;
    float  prevDemoTime  = 0.0f;
    int    prevSceneID   = -1;

    while (!glfwWindowShouldClose(window)) {
        double wallTime = glfwGetTime();
        float  dt = (float)(wallTime - prevWallTime);
        prevWallTime = wallTime;
        dt = glm::clamp(dt, 0.0f, 0.05f);

        if (hasAudio && audio.playing) {
            demoTime = audio.getTime();
        } else {
            demoTime += dt;
        }
        if (demoTime >= DEMO_DURATION) break;

        float ddemo = demoTime - prevDemoTime;
        prevDemoTime = demoTime;

        // Beat decay
        s_beatStrength = glm::max(0.0f, s_beatStrength - s_beatDecay * dt);
        audio.update(demoTime);

        // ---- Timeline: current scene ----
        float progress = 0.0f;
        int   sceneID  = timeline.getScene(demoTime, progress);

        const auto& entry    = timeline.scenes[sceneID];
        float sceneDur       = entry.endTime - entry.startTime;
        float sceneTimeLocal = progress * sceneDur;
        float timeLeft       = sceneDur * (1.0f - progress);

        // ---- Holy-Shit-Phase ----
        float hsPhase = smoothstepf(HS_START[sceneID], 1.0f, progress);

        // ---- Camera (für SDF-Szenen ohne eigene Kamera) ----
        cam.pos    = glm::vec3(0, 5, 15);
        cam.target = glm::vec3(0, 0,  0);
        cam.fovY   = 60.0f;

        // ---- PostFX per Szene ----
        // Bloom und Exposure dynamisch: Höher während Holy-Shit
        float bloomBase = 0.0f, exposureBase = 1.0f, chromaticBase = 0.0f;
        switch (sceneID) {
            case 0: bloomBase=0.6f;  exposureBase=1.0f;  chromaticBase=0.007f; break;
            case 1: bloomBase=1.4f;  exposureBase=1.3f;  chromaticBase=0.003f; break;
            case 2: bloomBase=0.9f;  exposureBase=1.1f;  chromaticBase=0.004f; break;
            case 3: bloomBase=1.8f;  exposureBase=1.5f;  chromaticBase=0.009f; break;
            case 4: bloomBase=2.2f;  exposureBase=1.3f;  chromaticBase=0.002f; break;
            case 5: bloomBase=2.5f;  exposureBase=1.6f;  chromaticBase=0.003f; break;
            case 6: bloomBase=1.8f;  exposureBase=1.4f;  chromaticBase=0.002f; break;
            case 7: bloomBase=0.8f;  exposureBase=0.9f;  chromaticBase=0.0f;   break;
        }
        // Holy-Shit boosted PostFX
        postfx.setBloom   (bloomBase    + hsPhase * 1.5f);
        postfx.setExposure(exposureBase + hsPhase * 0.4f);
        postfx.setChromatic(chromaticBase + hsPhase * 0.008f);

        // ---- Scene-Context builder ----
        auto buildCtx = [&](int id, float prog, float stime) -> SceneContext {
            SceneContext c;
            c.demoTime      = demoTime;
            c.sceneTime     = stime;
            c.progress      = prog;
            c.dt            = ddemo;
            c.beatPhase     = timeline.getBeatPhase(demoTime);
            c.barPhase      = timeline.getBarPhase(demoTime);
            c.beatStrength  = s_beatStrength;
            c.holyShitPhase = (id == sceneID) ? hsPhase : 0.0f;
            c.beat          = timeline.getBeat(demoTime);
            c.bar           = timeline.getBar(demoTime);
            c.sceneID       = id;
            c.width         = W;
            c.height        = H;
            c.cam           = &cam;
            return c;
        };

        // ---- Transition detection ----
        float transitionBlend = 0.0f;
        int   transitionType  = 7;
        bool  isTransitioning = (timeLeft < TRANSITION_DUR && sceneID < 7);

        if (isTransitioning) {
            int nextID = sceneID + 1;
            transitionBlend = 1.0f - timeLeft / TRANSITION_DUR; // 0=old, 1=new
            transitionType  = TRANSITION_TYPE[sceneID];

            // Berechne Progress der nächsten Szene (beginnt kurz vor Start)
            float nextDur     = timeline.scenes[nextID].endTime - timeline.scenes[nextID].startTime;
            float nextElapsed = TRANSITION_DUR * transitionBlend;
            float nextProg    = nextElapsed / nextDur;

            SceneContext nextCtx = buildCtx(nextID, nextProg, nextElapsed);
            scenes[nextID]->update(nextCtx);
            scenes[nextID]->render(nextCtx, hdrNextFBO);
        }

        // ---- Current scene render ----
        SceneContext ctx = buildCtx(sceneID, progress, sceneTimeLocal);
        scenes[sceneID]->update(ctx);
        scenes[sceneID]->render(ctx, hdrFBO);

        // ---- Post-FX ----
        glDisable(GL_FRAMEBUFFER_SRGB);
        postfx.process(
            hdrFBO.colorAttachments[0].tex,
            hdrNextFBO.colorAttachments[0].tex,
            demoTime,
            s_beatStrength,
            hsPhase,
            transitionBlend,
            transitionType
        );
        glEnable(GL_FRAMEBUFFER_SRGB);

        // ---- Scene name overlay (bottom-right) ----
        {
            textRenderer.setColor(glm::vec3(0.9f, 0.9f, 1.0f));
            const std::string& sname = timeline.scenes[sceneID].name;
            float scale = 3.0f; // each font pixel = 3 screen pixels → char = 18x21 px
            float charAdvance = scale * 6.0f;
            float textW = (float)sname.size() * charAdvance;
            float textX = W - textW - 24.0f;
            float textY = 24.0f;
            textRenderer.draw(sname, textX, textY, scale);
        }

        glfwSwapBuffers(window);
        glfwPollEvents();

        if (prevSceneID != sceneID) {
            printf("[%6.2fs] Scene %d: %s\n",
                   demoTime, sceneID, timeline.scenes[sceneID].name.c_str());
            prevSceneID = sceneID;
        }
    }

    printf("\n[Demo] Fin. Total time: %.2fs\n", demoTime);

    audio.stop();
    for (auto& s : scenes) s->destroy();
    postfx.destroy();
    textRenderer.destroy();
    hdrFBO.destroy();
    hdrNextFBO.destroy();

    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
