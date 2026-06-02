#include "scenes/scene03_city.h"
#include <cmath>
#include <glm/gtc/matrix_transform.hpp>

static float fhash(float x) {
    union { float f; uint32_t i; } u = {x * 127.1f + 311.7f};
    u.i ^= u.i >> 17; u.i *= 0xbf324c81u; u.i ^= u.i >> 11;
    return float(u.i) / 4294967296.0f;
}

// btype encoding:
//   archStyle = fmod(btype, 6) → 0=Brutalist 1=Glas 2=Industrial 3=Mixed 4=Billboard 5=Mega
//   part      = floor(btype/6) → 0=Hauptturm 1=Sockel 2=Spitze 3=Flügel

static Scene03City::InstanceData makeInst(float wx, float wz,
                                          float baseY, float h,
                                          float w,    float d,
                                          float seed, float btype) {
    Scene03City::InstanceData inst;
    inst.posH = glm::vec4(wx, baseY + h * 0.5f, wz, h);
    inst.data = glm::vec4(w, d, seed, btype);
    return inst;
}

void Scene03City::generateCity() {
    std::vector<InstanceData> instances;

    // Hauptstraßen-Korridore (für kollisionsfreie Kamera in Phase 1):
    // |wx| < 5  → N-S-Straße (Kamera fährt diese entlang)
    // |wz| < 5  → O-W-Straße

    const float spacing = 5.2f;
    const float gridSize = 160.0f;
    const int   gridN    = (int)(gridSize / spacing);

    for (int z = -gridN; z <= gridN; z++) {
        for (int x = -gridN; x <= gridN; x++) {
            float seed = fhash(float(x * 73 + z * 37));
            float wx = x * spacing + (fhash(seed + 0.01f) - 0.5f) * 2.0f;
            float wz = z * spacing + (fhash(seed + 0.02f) - 0.5f) * 2.0f;
            float r  = sqrtf(wx*wx + wz*wz);

            // Straßenkorridore freilassen
            if (fabsf(wx) < 5.0f || fabsf(wz) < 5.0f) continue;

            // Skip-Rate nach Zone
            float skipT = (r < 28.0f) ? 0.04f : (r < 75.0f) ? 0.08f : 0.20f;
            if (seed < skipT) continue;

            // Architektur-Stil nach Zone
            float ts = fhash(seed + 0.6f);
            float as_; // archStyle 0-5
            if      (r < 28.0f) as_ = (ts<0.40f)?5.f:(ts<0.80f)?1.f:0.f;
            else if (r < 75.0f) as_ = (ts<0.25f)?0.f:(ts<0.48f)?2.f:(ts<0.72f)?3.f:(ts<0.90f)?4.f:1.f;
            else                as_ = (ts<0.42f)?2.f:(ts<0.72f)?4.f:3.f;

            // Höhe nach Stil
            float hs = fhash(seed + 0.1f);
            float h;
            if      (as_ == 5.f) h = 42.f + fhash(seed+0.15f)*42.f + (hs>0.70f?25.f:0.f);
            else if (as_ == 1.f) h = 22.f + powf(hs, 0.42f)*48.f;
            else if (as_ == 4.f) h = 14.f + fhash(seed+0.15f)*22.f;
            else                 h = 4.f + powf(hs, 0.38f)*32.f + (hs>0.82f?18.f:0.f);

            // Breite / Tiefe
            float w, d;
            if (as_ == 5.f) {
                w = 7.f + fhash(seed+0.2f)*9.f;
                d = 6.f + fhash(seed+0.4f)*8.f;
            } else if (as_ == 4.f) {
                bool wx_ = fhash(seed+0.55f)>0.5f;
                w = wx_?(3.f+fhash(seed+0.2f)*2.5f):(0.8f+fhash(seed+0.2f)*1.2f);
                d = wx_?(0.8f+fhash(seed+0.4f)*1.2f):(3.f+fhash(seed+0.4f)*2.5f);
            } else {
                w = 1.6f + fhash(seed+0.2f)*3.5f;
                d = 1.6f + fhash(seed+0.4f)*3.5f;
            }

            // ── Hauptturm ────────────────────────────────────────────────────
            instances.push_back(makeInst(wx, wz, -7.f, h, w, d, seed, as_));

            // ── Sockel/Podium (55% Chance) ───────────────────────────────────
            if (fhash(seed + 0.95f) > 0.45f) {
                float ph = h * (0.18f + fhash(seed+0.81f)*0.16f);
                float pw = w * (1.65f + fhash(seed+0.82f)*0.80f);
                float pd = d * (1.65f + fhash(seed+0.83f)*0.80f);
                instances.push_back(makeInst(wx, wz, -7.f, ph, pw, pd, seed, as_ + 6.f));
            }

            // ── Spitze/Krone (35% Chance, nur für hohe Glas/Mega-Gebäude) ───
            if ((as_ == 1.f || as_ == 5.f) && h > 30.f && fhash(seed+0.98f) > 0.65f) {
                float sh = h * (0.14f + fhash(seed+0.84f)*0.18f);
                float sw = w * (0.11f + fhash(seed+0.85f)*0.08f);
                float sd = d * (0.11f + fhash(seed+0.86f)*0.08f);
                instances.push_back(makeInst(wx, wz, -7.f + h, sh, sw, sd, seed, as_ + 12.f));
            }

            // ── Flügel/Anbau (22% Chance, für Industrial/Mixed/Mega) ─────────
            if ((as_==2.f||as_==3.f||as_==5.f) && fhash(seed+0.99f) > 0.78f) {
                float wh = h * (0.35f + fhash(seed+0.87f)*0.30f);
                float ww = w * (0.55f + fhash(seed+0.88f)*0.45f);
                float wd = d * (0.55f + fhash(seed+0.89f)*0.45f);
                float ox = (w*0.5f + ww*0.5f) * (fhash(seed+0.91f)>0.5f?1.f:-1.f) * 0.88f;
                float oz = (fhash(seed+0.92f) - 0.5f) * d * 0.6f;
                instances.push_back(makeInst(wx+ox, wz+oz, -7.f, wh, ww, wd, seed, as_ + 18.f));
            }
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
    glClearColor(0.003f, 0.002f, 0.012f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);

    float t    = ctx.sceneTime;
    float prog = ctx.progress;
    float beatBoost = beatStrength * std::max(0.0f, 1.0f - ctx.beatPhase * 2.0f);

    // ── KAMERA: 4 sichere Phasen ──────────────────────────────────────────────
    // Sicherheitshöhen nach Radius:
    //   r < 28 (Core/Mega):  min y ≈ 28  (zwischen Megastrukturen, nicht drüber)
    //   r 28-75 (Mid):       min y ≈ 55  (über Glas-Turm-Spitzen bei max h=67→top=60)
    //   r > 75 (Outer):      min y ≈ 32  (über Billboard-Spitzen bei max h=36→top=29)
    //
    // Phase 1: Im Kern zwischen Megastrukturen — dramatisch von unten
    // Phase 2: Hochkran — schwenkt von Kernhöhe auf Panorama-Höhe
    // Phase 3: Weitwinkel-Orbital hoch oben
    // Phase 4: Absenken im Außenring (sicher über Flachdächern)

    glm::vec3 camPos, camTarget;
    float fovDeg;

    if (prog < 0.22f) {
        // Phase 1: Zwischen Megastrukturen, y≈28-38, r=20→14
        // Megastruktur-Tops gehen bis y≈108, wir fliegen ZWISCHEN ihnen
        float ease = prog / 0.22f;
        ease = ease * ease * (3.f - 2.f * ease);
        float ang = t * 0.22f;
        float rad = 20.f - ease * 6.f;   // r: 20 → 14 (näher an Gebäude)
        float ht  = 28.f + ease * 10.f;  // y: 28 → 38
        camPos    = glm::vec3(cosf(ang)*rad, ht, sinf(ang)*rad);
        // Ziel: aufwärts auf Mega-Spitzen schauen
        camTarget = glm::vec3(cosf(ang+0.3f)*6.f, 70.f + ease*35.f, sinf(ang+0.3f)*6.f);
        fovDeg    = 82.f - ease * 8.f;
    }
    else if (prog < 0.48f) {
        // Phase 2: Aufwärtskran — r=18, y: 30 → 130
        float ease = (prog - 0.22f) / 0.26f;
        ease = ease * ease * (3.f - 2.f * ease);
        float ang = t * 0.15f + 1.2f;
        float rad = 18.f + ease * 4.f;   // leicht nach außen
        float ht  = 30.f + ease * 100.f;
        camPos    = glm::vec3(cosf(ang)*rad, ht, sinf(ang)*rad);
        // Ziel: Gebäude-Mitte in verschiedener Höhe
        camTarget = glm::vec3(0.f, 30.f + ease * 40.f, 0.f);
        fovDeg    = 72.f + ease * 8.f;
    }
    else if (prog < 0.76f) {
        // Phase 3: Weites Orbital, r=65, y=90 (sicher über Mittelzone max 60)
        float ease = (prog - 0.48f) / 0.28f;
        ease = ease * ease * (3.f - 2.f * ease);
        float ang = t * 0.16f + 2.5f;
        float rad = 65.f + ease * 15.f;
        float ht  = 90.f + ease * 15.f;
        camPos    = glm::vec3(cosf(ang)*rad, ht, sinf(ang)*rad);
        camTarget = glm::vec3(0.f, 8.f, 0.f);
        fovDeg    = 64.f + ease * 8.f;
    }
    else {
        // Phase 4: Absenken im Außenring, r≈85 (sicher: outer tops ≤ y=29)
        float ease = (prog - 0.76f) / 0.24f;
        ease = ease * ease * (3.f - 2.f * ease);
        float ang = t * 0.28f + 4.2f;
        float ht  = 105.f - ease * 72.f;  // y: 105 → 33
        float rad = 85.f - ease * 12.f;   // r: 85 → 73 (kommt etwas näher)
        camPos    = glm::vec3(cosf(ang)*rad, ht, sinf(ang)*rad);
        // Ziel: vorwärts und leicht nach unten zu Skyline
        camTarget = glm::vec3(cosf(ang-0.4f)*(rad*0.5f),
                              ht - 15.f,
                              sinf(ang-0.4f)*(rad*0.5f));
        fovDeg    = 65.f + ease * 28.f;
    }

    // Beat-Shake
    float shake = beatBoost * 0.008f;
    camPos.x += sinf(ctx.demoTime * 83.f) * shake;
    camPos.y += cosf(ctx.demoTime * 67.f) * shake * 0.5f;

    glm::mat4 view = glm::lookAt(camPos, camTarget, glm::vec3(0,1,0));
    glm::mat4 proj = glm::perspective(glm::radians(fovDeg),
                                      (float)W/H, 0.5f, 1200.0f);

    // ── BODEN ─────────────────────────────────────────────────────────────────
    groundShader.use();
    groundShader.setMat4("uView",          view);
    groundShader.setMat4("uProj",          proj);
    groundShader.setFloat("uTime",         ctx.demoTime);
    groundShader.setFloat("uSceneTime",    ctx.sceneTime);
    groundShader.setFloat("uProgress",     prog);
    groundShader.setFloat("uBeatPhase",    ctx.beatPhase);
    groundShader.setFloat("uBarPhase",     ctx.barPhase);
    groundShader.setFloat("uBeatStrength", beatStrength);
    groundShader.setVec3("uCameraPos",     camPos);
    glDisable(GL_CULL_FACE);
    groundMesh.draw();
    glEnable(GL_CULL_FACE);

    // ── GEBÄUDE ───────────────────────────────────────────────────────────────
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
