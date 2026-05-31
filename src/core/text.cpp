#include "core/text.h"
#include <glm/gtc/matrix_transform.hpp>
#include <cmath>
#include <vector>

bool TextRenderer::init() {
    const char* vertSrc = R"glsl(
    #version 460 core
    layout(location=0) in vec2 pos;
    out vec2 uv;

    uniform mat4 proj;

    void main() {
        gl_Position = proj * vec4(pos, 0.0, 1.0);
        uv = pos;
    }
    )glsl";

    const char* fragSrc = R"glsl(
    #version 460 core
    in vec2 uv;
    out vec4 outColor;

    uniform vec3 textColor;

    void main() {
        outColor = vec4(textColor, 0.9);
    }
    )glsl";

    GLuint vert = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vert, 1, &vertSrc, nullptr);
    glCompileShader(vert);

    GLuint frag = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(frag, 1, &fragSrc, nullptr);
    glCompileShader(frag);

    textShader = glCreateProgram();
    glAttachShader(textShader, vert);
    glAttachShader(textShader, frag);
    glLinkProgram(textShader);

    glDeleteShader(vert);
    glDeleteShader(frag);

    int success;
    glGetProgramiv(textShader, GL_LINK_STATUS, &success);
    if (!success) {
        char log[512];
        glGetProgramInfoLog(textShader, 512, nullptr, log);
        printf("[TextRenderer] Shader link failed: %s\n", log);
        return false;
    }

    glCreateVertexArrays(1, &fontVAO);
    glCreateBuffers(1, &fontVBO);
    glBindVertexArray(fontVAO);
    glBindBuffer(GL_ARRAY_BUFFER, fontVBO);
    glBufferData(GL_ARRAY_BUFFER, 65536 * sizeof(float), nullptr, GL_DYNAMIC_DRAW);

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2*sizeof(float), (void*)0);

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    return true;
}

void TextRenderer::createFontTexture() {
    // Not used in simple quad approach
}

void TextRenderer::draw(const std::string& text, float x, float y, float size) {
    if (text.empty()) return;

    // Build vertex buffer: each character as a colored rectangle
    std::vector<float> verts;
    float px = x;

    for (char ch : text) {
        if (ch == ' ') {
            px += size * 0.5f;
            continue;
        }

        // Draw char as a quad (2 triangles)
        float w = size * 0.6f;
        float h = size;

        // Triangle 1
        verts.push_back(px);        verts.push_back(y);
        verts.push_back(px + w);    verts.push_back(y);
        verts.push_back(px);        verts.push_back(y + h);

        // Triangle 2
        verts.push_back(px + w);    verts.push_back(y);
        verts.push_back(px + w);    verts.push_back(y + h);
        verts.push_back(px);        verts.push_back(y + h);

        px += w;
    }

    if (verts.empty()) return;

    glUseProgram(textShader);
    glUniform3fv(glGetUniformLocation(textShader, "textColor"), 1, &textColor[0]);

    glm::mat4 proj = glm::ortho(0.0f, 1920.0f, 0.0f, 1080.0f, -1.0f, 1.0f);
    glUniformMatrix4fv(glGetUniformLocation(textShader, "proj"), 1, GL_FALSE, &proj[0][0]);

    glBindVertexArray(fontVAO);
    glBindBuffer(GL_ARRAY_BUFFER, fontVBO);
    glBufferSubData(GL_ARRAY_BUFFER, 0, verts.size() * sizeof(float), verts.data());

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glDrawArrays(GL_TRIANGLES, 0, (GLsizei)(verts.size() / 2));
    glDisable(GL_BLEND);

    glBindVertexArray(0);
    glUseProgram(0);
}

void TextRenderer::destroy() {
    if (fontVAO) glDeleteVertexArrays(1, &fontVAO);
    if (fontVBO) glDeleteBuffers(1, &fontVBO);
    if (textShader) glDeleteProgram(textShader);
}
