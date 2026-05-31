#pragma once
#include "scene/scene.h"
#include "core/mesh.h"
#include <vector>
#include <glm/glm.hpp>

class Scene03City : public Scene {
public:
    bool init(int w, int h) override;
    void update(const SceneContext& ctx) override;
    void render(const SceneContext& ctx, const Framebuffer& hdrTarget) override;
    void destroy() override;

private:
    Shader  shader;        // buildings
    Shader  groundShader;  // wet streets
    Mesh    buildingMesh;
    Mesh    groundMesh;

    GLuint  instanceVBO  = 0;
    int     instanceCount = 0;

    float   beatStrength = 0.0f;

    // Per-instance data — packed into 2x vec4
    struct InstanceData {
        glm::vec4 posH;   // xyz=world base pos, w=height
        glm::vec4 data;   // x=width, y=depth, z=seed, w=buildingType(0-3)
    };

    void generateCity();
};
