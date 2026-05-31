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

    float gridSize = 160.0f;
    float spacing  = 6.5f;
    int   gridN    = (int)(gridSize / spacing);

    for (int z = -gridN; z <= gridN; z++) {
        for (int x = -gridN; x <= gridN; x++) {
            float seed = fhash(float(x * 73 + z * 37));
            if (seed < 0.12f) continue;

            float wx = x * spacing + (fhash(seed + 0.01f) - 0.5f) * 3.0f;
            float wz = z * spacing + (fhash(seed + 0.02f) - 0.5f) * 3.0f;

            // Height distribution: mostly mid-rise, some skyscrapers
            float heightSeed = fhash(seed + 0.1f);
            float h = 3.0f + powf(heightSeed, 0.4f) * 38.0f;
            if (heightSeed > 0.85f) h = 28.0f + fhash(seed + 0.15f) * 28.0f; // supertall

            float w = 1.5f + fhash(seed + 0.2f) * 3.0f;
            float d = 1.5f + fhash(seed + 0.4f) * 3.0f;

            // Building type: 0=Brutalist, 1=Glass, 2=Industrial, 3=Mixed
            float typeSeed = fhash(seed + 0.6f);
            float btype;
            if      (typeSeed < 0.40f) btype = 0.0f;
            else if (typeSeed < 0.65f) btype = 1.0f;
            else if (typeSeed < 0.85f) btype = 2.0f;
            else                       btype = 3.0f;

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

    // location 4 → posH
    glEnableVertexAttribArray(4);
    glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(InstanceData), (void*)0);
    glVertexAttribDivisor(4, 1);

    // location 5 → data
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
    groundMesh   = Mesh::makeGrid(120, 120, 350.0f);

    generateCity();
    initialized = true;
    return true;
}

void Scene03City::update(const SceneContext& ctx) {
    beatStrength = beatStrength * 0.85f + ctx.beatStrength * 0.15f;
    if (ctx.beatPhase < 0.05f) beatStrength = ctx.beatStrength;
}

void Scene03City::render(const SceneContext& ctx, const Framebuffer& hdrTarget) {
    hdrTarget.bind();
    glViewport(0, 0, W, H);
    glClearColor(0.005f, 0.005f, 0.015f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);

    float t    = ctx.sceneTime;
    float prog = ctx.progress;
    float beatBoost = beatStrength * std::max(0.0f, 1.0f - ctx.beatPhase * 2.0f);

    // --- Kinematische Kamera: 3 Phasen ---
    glm::vec3 camPos;
    glm::vec3 camTarget;
    float fovDeg;

    if (prog < 0.30f) {
        // Phase 1: Straßenebene — zwischen Gebäuden hindurch
        float ease = prog / 0.30f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.18f;
        float rad = 8.0f + ease * 6.0f;
        camPos    = glm::vec3(sinf(ang) * rad, -4.5f + ease * 2.0f, cosf(ang) * rad);
        camTarget = glm::vec3(sinf(ang + 0.6f) * 4.0f, 2.0f, cosf(ang + 0.6f) * 4.0f);
        fovDeg    = 85.0f - ease * 15.0f;
    }
    else if (prog < 0.65f) {
        // Phase 2: Steigt auf — Korruption breitet sich aus
        float ease = (prog - 0.30f) / 0.35f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.22f + 1.0f;
        float rad = 14.0f + (28.0f - 14.0f) * ease;
        float ht  = -2.5f + (18.0f - (-2.5f)) * ease;
        camPos    = glm::vec3(sinf(ang) * rad, ht, cosf(ang) * rad);
        camTarget = glm::vec3(0.0f, 4.0f + (10.0f - 4.0f) * ease, 0.0f);
        fovDeg    = 70.0f - ease * 8.0f;
    }
    else {
        // Phase 3: Orbitalschuss — gesamte korrupte Stadt sichtbar
        float ease = (prog - 0.65f) / 0.35f;
        ease = ease * ease * (3.0f - 2.0f * ease);
        float ang = t * 0.28f + 2.5f;
        float rad = 28.0f + ease * 12.0f;
        float ht  = 18.0f + ease * 10.0f;
        camPos    = glm::vec3(sinf(ang) * rad, ht, cosf(ang) * rad);
        camTarget = glm::vec3(0.0f, 5.0f, 0.0f);
        fovDeg    = 62.0f + ease * 6.0f;
    }

    // Beat-Shake
    float shake = beatBoost * 0.012f;
    camPos.x += sinf(ctx.demoTime * 79.0f) * shake;
    camPos.y += cosf(ctx.demoTime * 61.0f) * shake * 0.5f;

    glm::mat4 view = glm::lookAt(camPos, camTarget, glm::vec3(0,1,0));
    glm::mat4 proj = glm::perspective(glm::radians(fovDeg), (float)W/H, 0.2f, 800.0f);

    // --- Boden zuerst (depth write) ---
    groundShader.use();
    groundShader.setMat4("uView",        view);
    groundShader.setMat4("uProj",        proj);
    groundShader.setFloat("uTime",       ctx.demoTime);
    groundShader.setFloat("uSceneTime",  ctx.sceneTime);
    groundShader.setFloat("uProgress",   prog);
    groundShader.setFloat("uBeatPhase",  ctx.beatPhase);
    groundShader.setFloat("uBarPhase",   ctx.barPhase);
    groundShader.setFloat("uBeatStrength", beatStrength);
    groundShader.setVec3("uCameraPos",   camPos);

    glDisable(GL_CULL_FACE);
    groundMesh.draw();
    glEnable(GL_CULL_FACE);

    // --- Gebäude ---
    shader.use();
    shader.setMat4("uView",         view);
    shader.setMat4("uProj",         proj);
    shader.setFloat("uTime",         ctx.demoTime);
    shader.setFloat("uSceneTime",   ctx.sceneTime);
    shader.setFloat("uProgress",    prog);
    shader.setFloat("uBeatPhase",   ctx.beatPhase);
    shader.setFloat("uBarPhase",    ctx.barPhase);
    shader.setFloat("uBeatStrength", beatStrength);
    shader.setFloat("uHolyShitPhase", ctx.holyShitPhase);
    shader.setVec3("uCameraPos",    camPos);
    shader.setVec2("uResolution",   glm::vec2(W, H));

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
