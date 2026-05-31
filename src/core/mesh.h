#pragma once
#include <glad/gl.h>
#include <glm/glm.hpp>
#include <vector>

struct Vertex {
    glm::vec3 pos;
    glm::vec3 normal;
    glm::vec2 uv;
    glm::vec4 tangent;
};

class Mesh {
public:
    GLuint vao = 0, vbo = 0, ebo = 0;
    GLsizei indexCount = 0;
    GLsizei vertexCount = 0;

    Mesh() = default;
    ~Mesh() { destroy(); }
    Mesh(const Mesh&) = delete;
    Mesh& operator=(const Mesh&) = delete;

    Mesh(Mesh&& o) noexcept
        : vao(o.vao), vbo(o.vbo), ebo(o.ebo),
          indexCount(o.indexCount), vertexCount(o.vertexCount) {
        o.vao = o.vbo = o.ebo = 0;
        o.indexCount = o.vertexCount = 0;
    }
    Mesh& operator=(Mesh&& o) noexcept {
        if (this != &o) {
            destroy();
            vao = o.vao; vbo = o.vbo; ebo = o.ebo;
            indexCount = o.indexCount; vertexCount = o.vertexCount;
            o.vao = o.vbo = o.ebo = 0;
            o.indexCount = o.vertexCount = 0;
        }
        return *this;
    }

    void upload(const std::vector<Vertex>& verts, const std::vector<uint32_t>& indices);
    void uploadPoints(const std::vector<glm::vec4>& points); // for particle rendering
    void draw() const;
    void drawPoints(GLsizei count = -1) const;
    void destroy();

    static Mesh makeFullscreenQuad();
    static Mesh makeBox(float hw, float hh, float hd);
    static Mesh makeSphere(int rings, int sectors);
    static Mesh makeGrid(int nx, int nz, float size); // for city ground

    // Returns a point cloud SSBO handle (managed externally)
    static GLuint createParticleSSBO(size_t count, size_t stride);
};
