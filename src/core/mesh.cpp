#include "core/mesh.h"
#include <cmath>

void Mesh::upload(const std::vector<Vertex>& verts, const std::vector<uint32_t>& indices) {
    destroy();
    vertexCount = (GLsizei)verts.size();
    indexCount  = (GLsizei)indices.size();

    glGenVertexArrays(1, &vao);
    glGenBuffers(1, &vbo);
    glGenBuffers(1, &ebo);

    glBindVertexArray(vao);

    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, verts.size() * sizeof(Vertex), verts.data(), GL_STATIC_DRAW);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(uint32_t), indices.data(), GL_STATIC_DRAW);

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, pos));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, normal));
    glEnableVertexAttribArray(2);
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, uv));
    glEnableVertexAttribArray(3);
    glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, tangent));

    glBindVertexArray(0);
}

void Mesh::uploadPoints(const std::vector<glm::vec4>& points) {
    destroy();
    vertexCount = (GLsizei)points.size();

    glGenVertexArrays(1, &vao);
    glGenBuffers(1, &vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, points.size() * sizeof(glm::vec4), points.data(), GL_DYNAMIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, sizeof(glm::vec4), nullptr);
    glBindVertexArray(0);
}

void Mesh::draw() const {
    glBindVertexArray(vao);
    if (ebo) glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_INT, nullptr);
    else     glDrawArrays(GL_TRIANGLES, 0, vertexCount);
    glBindVertexArray(0);
}

void Mesh::drawPoints(GLsizei count) const {
    glBindVertexArray(vao);
    glDrawArrays(GL_POINTS, 0, count < 0 ? vertexCount : count);
    glBindVertexArray(0);
}

void Mesh::destroy() {
    if (vao) { glDeleteVertexArrays(1, &vao); vao = 0; }
    if (vbo) { glDeleteBuffers(1, &vbo); vbo = 0; }
    if (ebo) { glDeleteBuffers(1, &ebo); ebo = 0; }
    indexCount = vertexCount = 0;
}

Mesh Mesh::makeFullscreenQuad() {
    // Generated via gl_VertexID in shader, just need empty VAO
    Mesh m;
    glGenVertexArrays(1, &m.vao);
    m.vertexCount = 3;
    return m;
}

Mesh Mesh::makeBox(float hw, float hh, float hd) {
    std::vector<Vertex> verts;
    std::vector<uint32_t> idx;

    auto face = [&](glm::vec3 n, glm::vec3 u, glm::vec3 v, float su, float sv) {
        uint32_t base = (uint32_t)verts.size();
        for (int j = -1; j <= 1; j += 2)
            for (int i = -1; i <= 1; i += 2) {
                Vertex vtx;
                vtx.pos    = n * glm::vec3(hw, hh, hd) + u * ((float)i * su) + v * ((float)j * sv);
                vtx.normal = n;
                vtx.uv     = glm::vec2((i + 1) * 0.5f, (j + 1) * 0.5f);
                verts.push_back(vtx);
            }
        idx.insert(idx.end(), {base,base+1,base+2, base+1,base+3,base+2});
    };

    face({ 1,0,0}, {0,0,1}, {0,1,0}, hd, hh);
    face({-1,0,0}, {0,0,-1},{0,1,0}, hd, hh);
    face({ 0,1,0}, {1,0,0}, {0,0,1}, hw, hd);
    face({ 0,-1,0},{1,0,0}, {0,0,-1},hw, hd);
    face({ 0,0,1}, {1,0,0}, {0,1,0}, hw, hh);
    face({ 0,0,-1},{-1,0,0},{0,1,0}, hw, hh);

    Mesh m;
    m.upload(verts, idx);
    return m;
}

Mesh Mesh::makeSphere(int rings, int sectors) {
    std::vector<Vertex> verts;
    std::vector<uint32_t> idx;
    const float pi = 3.14159265359f;

    for (int r = 0; r <= rings; ++r) {
        float phi = pi * r / rings;
        for (int s = 0; s <= sectors; ++s) {
            float theta = 2.0f * pi * s / sectors;
            Vertex v;
            v.pos    = { sinf(phi)*cosf(theta), cosf(phi), sinf(phi)*sinf(theta) };
            v.normal = v.pos;
            v.uv     = { (float)s/sectors, (float)r/rings };
            verts.push_back(v);
        }
    }
    for (int r = 0; r < rings; ++r)
        for (int s = 0; s < sectors; ++s) {
            uint32_t a = r*(sectors+1)+s, b=a+1, c=a+(sectors+1), d=c+1;
            idx.insert(idx.end(), {a,b,c, b,d,c});
        }

    Mesh m;
    m.upload(verts, idx);
    return m;
}

Mesh Mesh::makeGrid(int nx, int nz, float size) {
    std::vector<Vertex> verts;
    std::vector<uint32_t> idx;
    float dx = size / nx, dz = size / nz;
    for (int z = 0; z <= nz; ++z)
        for (int x = 0; x <= nx; ++x) {
            Vertex v;
            v.pos    = { x * dx - size * 0.5f, 0.0f, z * dz - size * 0.5f };
            v.normal = { 0, 1, 0 };
            v.uv     = { (float)x / nx, (float)z / nz };
            verts.push_back(v);
        }
    for (int z = 0; z < nz; ++z)
        for (int x = 0; x < nx; ++x) {
            uint32_t a = z*(nx+1)+x, b=a+1, c=a+(nx+1), d=c+1;
            idx.insert(idx.end(), {a,c,b, b,c,d});
        }
    Mesh m;
    m.upload(verts, idx);
    return m;
}

GLuint Mesh::createParticleSSBO(size_t count, size_t stride) {
    GLuint ssbo;
    glGenBuffers(1, &ssbo);
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, ssbo);
    glBufferData(GL_SHADER_STORAGE_BUFFER, (GLsizeiptr)(count * stride), nullptr, GL_DYNAMIC_DRAW);
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);
    return ssbo;
}
