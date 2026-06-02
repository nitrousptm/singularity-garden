#include "scenes/scene03_city.h"
#include <cmath>
#include <glm/gtc/matrix_transform.hpp>

static float fhash(float x) {
    union { float f; uint32_t i; } u = {x * 127.1f + 311.7f};
    u.i ^= u.i >> 17; u.i *= 0xbf324c81u; u.i ^= u.i >> 11;
    return float(u.i) / 4294967296.0f;
}

void Scene03City::generateCity() {
    std::vector<InstanceData> instances;

    // Zones:
    // r < 28  → Core: Megastrukturen (5) + Glas-Türme (1)
    // r < 75  → Mid:  Brutalist (0), Industrial (2), Mixed (3), Billboard (4)
    // r < 160 → Outer: Industrial (2), Billboard (4), Mixed (3)

    const float gridSize = 160.0f;
    const float spacing  = 5.2f;   // dichter als vorher
    const int   gridN    = (int)(gridSize / spacing);

    for (int z = -gridN; z <= gridN; z++) {
        for (int x = -gridN; x <= gridN; x++) {
            float seed = fhash(float(x * 73 + z * 37));

            float wx = x * spacing + (fhash(seed + 0.01f) - 0.5f) * 2.2f;
            float wz = z * spacing + (fhash(seed + 0.02f) - 0.5f) * 2.2f;
            float r  = sqrtf(wx*wx + wz*wz);

            // Skip-Rate je nach Zone
            float skipThresh = (r < 28.0f) ? 0.04f : (r < 75.0f) ? 0.08f : 0.18f;
            if (seed < skipThresh) continue;

            // Gebäude-Typ nach Zone
            float typeSeed = fhash(seed + 0.6f);
            float btype;

            if (r < 28.0f) {
                if      (typeSeed < 0.40f) btype = 5.0f;  // Megastruktur
                else if (typeSeed < 0.80f) btype = 1.0f;  // Glas-Turm
                else                       btype = 0.0f;  // Brutalist
            }
            else if (r < 75.0f) {
                if      (typeSeed < 0.25f) btype = 0.0f;  // Brutalist
                else if (typeSeed < 0.48f) btype = 2.0f;  // Industrial
                else if (typeSeed < 0.72f) btype = 3.0f;  // Mixed
                else if (typeSeed < 0.90f) btype = 4.0f;  // Billboard-Pillar
                else                       btype = 1.0f;  // einzelne Glas-Türme
            }
            else {
                if      (typeSeed < 0.42f) btype = 2.0f;  // Industrial
                else if (typeSeed < 0.72f) btype = 4.0f;  // Billboard
                else                       btype = 3.0f;  // Mixed
            }

            // Höhe nach Typ
            float heightSeed = fhash(seed + 0.1f);
            float h;
            if (btype == 5.0f) {
                h = 42.0f + fhash(seed + 0.15f) * 38.0f;
                if (heightSeed > 0.70f) h = 70.0f + fhash(seed + 0.20f) * 45.0f;
            }
            else if (btype == 1.0f) {
                h = 22.0f + powf(heightSeed, 0.45f) * 45.0f;
            }
            else if (btype == 4.0f) {
                h = 14.0f + fhash(seed + 0.15f) * 22.0f;
            }
            else {
                h = 4.0f + powf(heightSeed, 0.38f) * 32.0f;
                if (heightSeed > 0.82f) h = 30.0f + fhash(seed + 0.15f) * 22.0f;
            }

            // Breite / Tiefe
            float w, d;
            if (btype == 5.0f) {
                w = 7.0f + fhash(seed + 0.2f) * 9.0f;
                d = 6.0f + fhash(seed + 0.4f) * 8.0f;
            }
            else if (btype == 4.0f) {
                // Billboard: schmal + flach (große Werbefläche)
                bool wideX = fhash(seed + 0.55f) > 0.5f;
                w = wideX ? (3.0f + fhash(seed + 0.2f) * 2.5f) : (0.8f + fhash(seed + 0.2f) * 1.2f);
                d = wideX ? (0.8f + fhash(seed + 0.4f) * 1.2f) : (3.0f + fhash(seed + 0.4f) * 2.5f);
            }
            else {
                w = 1.6f + fhash(seed + 0.2f) * 3.5f;
                d = 1.6f + fhash(seed + 0.4f) * 3.5f;
            }

            InstanceData inst;
            inst.posH = glm::vec4(wx, -7.0f + h * 0.5f, wz, h);
            inst.data = glm::vec4(w, d, seed, btype);
            instances.push_back(inst);
        }
    }

    instanceCount = (int)instances.size();

    glGenBuffers(1, &instanceVBO);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
    glBufferData(GL_ARRAY_BUFFER,
                 instances.size() * sizeof(InstanceData),
                 instances.data(), GL_STATIC_DRAW);

    glBindVertexArray(buildingMesh.vao);
    glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);

    glEnableVertexAttribArray(4);
    glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(InstanceData), (void*)0);
    glVertexAttribDivisor(4, 1);

    glEnableVertexAttribArray(5);
    glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, sizeof(InstanceData),
                          (void*)sizeof(glm::vec4));
    glVertexAttribDivisor(5, 1);

    glBindVertexArray(0);
}

bool Scene03City::init(int w, int h) {
    W = w; H = h;
    initFullscreenVAO();

    if (!shader.loadVF("shaders/scenes/scene03_city.vert",
                       "shaders/scenes/scene03_city.frag"))
        return false;

    if (!groundShader.loadVF("shaders/scenes/scene03_ground.vert",
                             "shaders/scenes/scene03_ground.frag"))
        return false;

    buildingMesh = Mesh::makeBox(0.5f, 0.5f, 0.5f);
    groundMesh   = Mesh::makeGrid(120, 120, 380.0f);

    generateCity();
    initialized = true;
    return true;
}

void Scene03City::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.82f + ctx.beatStrength * 0.18f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;
}

void Scene03City::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    // Tiefe, violett-schwarze Nacht — Cyberpunk Sky
    glClearColor(0.003f, 0.002f, 0.012f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);

    float t    = ctx.sceneTime;
    float prog = ctx.progress;
    float beatBoost = beatStrength * std::max(0.0f, 1.0f - ctx.beatPhase * 2.0f);

    // ─── KINEMATISCHE KAMERA: 4 Phasen (Cyberpunk 2077 Style) ───────────────
    glm::vec3 camPos, camTarget;
    float fovDeg;

    if (prog < 0.22f) {
        // Phase 1: Straßen-Korridor — Flug durch Neon-Schluchten, Bodennähe
        float ease = prog / 0.22f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float fwd  = -12.0f + ease * 55.0f;
        float side = sinf(t * 0.35f) * 5.0f;
        float camY = -4.8f + sinf(t * 0.28f) * 0.6f;
        camPos    = glm::vec3(side, camY, fwd);
        camTarget = glm::vec3(side * 0.25f + cosf(t * 0.28f) * 3.0f,
                              camY + 3.5f + ease * 8.0f,
                              fwd + 18.0f);
        fovDeg    = 95.0f - ease * 25.0f;
    }
    else if (prog < 0.48f) {
        // Phase 2: Hochkran — steigt an der Seite einer Megastruktur auf
        float ease = (prog - 0.22f) / 0.26f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.14f + 0.8f;
        float rad = 20.0f - ease * 5.0f;
        float ht  = -4.0f + ease * 52.0f;
        camPos    = glm::vec3(cosf(ang) * rad, ht, sinf(ang) * rad);
        camTarget = glm::vec3(0.0f, ht + 18.0f * (1.0f - ease * 0.6f), 0.0f);
        fovDeg    = 72.0f + ease * 8.0f;
    }
    else if (prog < 0.76f) {
        // Phase 3: Weiter Orbital-Schuss — Megacity von oben
        float ease = (prog - 0.48f) / 0.28f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.18f + 2.2f;
        float rad = 38.0f + ease * 30.0f;
        float ht  = 30.0f + ease * 25.0f;
        camPos    = glm::vec3(cosf(ang) * rad, ht, sinf(ang) * rad);
        camTarget = glm::vec3(0.0f, 6.0f, 0.0f);
        fovDeg    = 64.0f + ease * 6.0f;
    }
    else {
        // Phase 4: Sturzflug in Neon-Billboard-Cluster
        float ease = (prog - 0.76f) / 0.24f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.32f + 3.8f;
        float rad = 68.0f - ease * 52.0f;
        float ht  = 55.0f - ease * 48.0f;
        camPos    = glm::vec3(cosf(ang) * rad, ht, sinf(ang) * rad);
        camTarget = glm::vec3(cosf(ang + 0.5f) * (rad * 0.25f),
                              ht - 8.0f,
                              sinf(ang + 0.5f) * (rad * 0.25f));
        fovDeg    = 68.0f + ease * 32.0f;
    }

    // Beat-Shake (härter beim Sturzflug)
    float shake = beatBoost * (0.010f + prog * 0.008f);
    camPos.x += sinf(ctx.demoTime * 83.0f) * shake;
    camPos.y += cosf(ctx.demoTime * 67.0f) * shake * 0.5f;

    glm::mat4 view = glm::lookAt(camPos, camTarget, glm::vec3(0,1,0));
    glm::mat4 proj = glm::perspective(glm::radians(fovDeg), (float)W/H, 0.15f, 1000.0f);

    // ─── BODEN ───────────────────────────────────────────────────────────────
    groundShader.use();
    groundShader.setMat4("uView",         view);
    groundShader.setMat4("uProj",         proj);
    groundShader.setFloat("uTime",        ctx.demoTime);
    groundShader.setFloat("uSceneTime",   ctx.sceneTime);
    groundShader.setFloat("uProgress",    prog);
    groundShader.setFloat("uBeatPhase",   ctx.beatPhase);
    groundShader.setFloat("uBarPhase",    ctx.barPhase);
    groundShader.setFloat("uBeatStrength", beatStrength);
    groundShader.setVec3("uCameraPos",    camPos);

    glDisable(GL_CULL_FACE);
    groundMesh.draw();
    glEnable(GL_CULL_FACE);

    // ─── GEBÄUDE ─────────────────────────────────────────────────────────────
    shader.use();
    shader.setMat4("uView",          view);
    shader.setMat4("uProj",          proj);
    shader.setFloat("uTime",          ctx.demoTime);
    shader.setFloat("uSceneTime",    ctx.sceneTime);
    shader.setFloat("uProgress",     prog);
    shader.setFloat("uBeatPhase",    ctx.beatPhase);
    shader.setFloat("uBarPhase",     ctx.barPhase);
    shader.setFloat("uBeatStrength", beatStrength);
    shader.setFloat("uHolyShitPhase", ctx.holyShitPhase);
    shader.setVec3("uCameraPos",     camPos);
    shader.setVec2("uResolution",    glm::vec2(W, H));

    glBindVertexArray(buildingMesh.vao);
    glDrawElementsInstanced(GL_TRIANGLES, buildingMesh.indexCount,
                            GL_UNSIGNED_INT, nullptr, instanceCount);
    glBindVertexArray(0);

    glDisable(GL_CULL_FACE);
    glDisable(GL_DEPTH_TEST);
}

void Scene03City::destroy() {
    if (instanceVBO) { glDeleteBuffers(1, &instanceVBO); instanceVBO = 0; }
    if (emptyVAO)    { glDeleteVertexArrays(1, &emptyVAO); emptyVAO = 0; }
}
