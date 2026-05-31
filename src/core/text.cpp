#include "core/text.h"
#include <cmath>
#include <vector>

bool TextRenderer::init() {
    const char* vertSrc = R"glsl(
    #version 460 core
    layout(location=0) in vec2 pos;
    layout(location=1) in vec2 uv;

    out vec2 fragUV;

    uniform mat4 proj;

    void main() {
        gl_Position = proj * vec4(pos, 0.0, 1.0);
        fragUV = uv;
    }
    )glsl";

    const char* fragSrc = R"glsl(
    #version 460 core
    in vec2 fragUV;
    out vec4 outColor;

    uniform sampler2D fontSampler;
    uniform vec3 textColor;

    void main() {
        float alpha = texture(fontSampler, fragUV).r;
        if (alpha < 0.1) discard;
        outColor = vec4(textColor, alpha);
    }
    )glsl";

    // Compile shader
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

    // Check for link errors
    int success;
    glGetProgramiv(textShader, GL_LINK_STATUS, &success);
    if (!success) {
        char log[512];
        glGetProgramInfoLog(textShader, 512, nullptr, log);
        printf("[TextRenderer] Shader link failed: %s\n", log);
        return false;
    }

    // Create font texture (simple bitmap)
    createFontTexture();

    // Create VAO/VBO for dynamic text
    glCreateVertexArrays(1, &fontVAO);
    glCreateBuffers(1, &fontVBO);
    glBindVertexArray(fontVAO);
    glBindBuffer(GL_ARRAY_BUFFER, fontVBO);
    glBufferData(GL_ARRAY_BUFFER, 1024 * sizeof(float), nullptr, GL_DYNAMIC_DRAW);

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4*sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4*sizeof(float), (void*)(2*sizeof(float)));

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    return true;
}

void TextRenderer::createFontTexture() {
    // Create a simple 512x96 bitmap font texture with ASCII chars 32-127
    constexpr int texW = 512, texH = 96;
    std::vector<uint8_t> fontData(texW * texH, 0);

    // Simple monospace font rendering: each character is 32x16 pixels
    const int charW = 32, charH = 16;

    auto drawChar = [&](int ch, int charIdx) {
        int col = (charIdx % FONT_CHARS_X) * charW;
        int row = (charIdx / FONT_CHARS_X) * charH;

        // Draw a simple 5x7 bitmap for each character
        // This is hardcoded for digits and common letters
        static const uint8_t patterns[] = {
            0x00, 0x00, 0x00, 0x00, 0x00,  // space
            0x20, 0x20, 0x20, 0x00, 0x20,  // !
            0x50, 0x50, 0x00, 0x00, 0x00,  // "
            0x50, 0xF8, 0x50, 0xF8, 0x50,  // #
            0x20, 0x70, 0x20, 0xE0, 0x20,  // $
            0x88, 0x10, 0x20, 0x40, 0x88,  // %
            0x60, 0x90, 0x60, 0x90, 0x60,  // &
            0x20, 0x20, 0x00, 0x00, 0x00,  // '
            0x10, 0x20, 0x20, 0x20, 0x10,  // (
            0x40, 0x20, 0x20, 0x20, 0x40,  // )
            0x20, 0xA8, 0x70, 0xA8, 0x20,  // *
            0x20, 0x20, 0xF8, 0x20, 0x20,  // +
            0x00, 0x00, 0x00, 0x20, 0x40,  // ,
            0x00, 0x00, 0xF8, 0x00, 0x00,  // -
            0x00, 0x00, 0x00, 0x00, 0x20,  // .
            0x08, 0x10, 0x20, 0x40, 0x80,  // /
            0x70, 0x88, 0x88, 0x88, 0x70,  // 0
            0x20, 0x60, 0x20, 0x20, 0x70,  // 1
            0x70, 0x08, 0x70, 0x80, 0xF8,  // 2
            0x70, 0x08, 0x30, 0x08, 0x70,  // 3
            0x88, 0x88, 0xF8, 0x08, 0x08,  // 4
            0xF8, 0x80, 0xF0, 0x08, 0xF0,  // 5
            0x70, 0x80, 0xF0, 0x88, 0x70,  // 6
            0xF8, 0x08, 0x10, 0x20, 0x40,  // 7
            0x70, 0x88, 0x70, 0x88, 0x70,  // 8
            0x70, 0x88, 0x78, 0x08, 0x70,  // 9
        };

        if (ch < 58) {  // Only digits and some symbols
            const uint8_t* pat = &patterns[(ch - 32) * 5];
            for (int py = 0; py < 7; py++) {
                for (int px = 0; px < 5; px++) {
                    uint8_t bit = (pat[px] >> (7 - py)) & 1;
                    if (bit) {
                        int fx = col + 8 + px * 4;
                        int fy = row + 4 + py * 2;
                        if (fx >= 0 && fx < texW && fy >= 0 && fy < texH) {
                            fontData[fy * texW + fx] = 255;
                        }
                    }
                }
            }
        }
    };

    // Draw ASCII 32-127 (96 chars, 16x6 grid)
    for (int ch = 32; ch < 128; ch++) {
        drawChar(ch, ch - 32);
    }

    // Create OpenGL texture
    glCreateTextures(GL_TEXTURE_2D, 1, &fontTex);
    glTextureStorage2D(fontTex, 1, GL_R8, texW, texH);
    glTextureSubImage2D(fontTex, 0, 0, 0, texW, texH, GL_RED, GL_UNSIGNED_BYTE, fontData.data());

    glTextureParameteri(fontTex, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTextureParameteri(fontTex, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTextureParameteri(fontTex, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTextureParameteri(fontTex, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
}

void TextRenderer::draw(const std::string& text, float x, float y, float size) {
    if (text.empty()) return;

    glUseProgram(textShader);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, fontTex);
    glUniform1i(glGetUniformLocation(textShader, "fontSampler"), 0);
    glUniform3fv(glGetUniformLocation(textShader, "textColor"), 1, &textColor[0]);

    glm::mat4 proj = glm::ortho(0.0f, 1920.0f, 0.0f, 1080.0f, -1.0f, 1.0f);
    glUniformMatrix4fv(glGetUniformLocation(textShader, "proj"), 1, GL_FALSE, &proj[0][0]);

    // Build vertex buffer for text quads
    std::vector<float> verts;
    float px = x;
    const float charW = size * 0.6f;
    const float charH = size;

    constexpr int FONT_CHARS_X = 16;
    const float uvCharW = 1.0f / FONT_CHARS_X;
    const float uvCharH = 1.0f / 6.0f;

    for (char ch : text) {
        if (ch < 32 || ch > 127) continue;

        int charIdx = ch - 32;
        int col = charIdx % FONT_CHARS_X;
        int row = charIdx / FONT_CHARS_X;

        float u0 = col * uvCharW;
        float v0 = row * uvCharH;
        float u1 = u0 + uvCharW;
        float v1 = v0 + uvCharH;

        // Triangle 1
        verts.push_back(px);           verts.push_back(y);            verts.push_back(u0); verts.push_back(v0);
        verts.push_back(px + charW);   verts.push_back(y);            verts.push_back(u1); verts.push_back(v0);
        verts.push_back(px);           verts.push_back(y + charH);    verts.push_back(u0); verts.push_back(v1);

        // Triangle 2
        verts.push_back(px + charW);   verts.push_back(y);            verts.push_back(u1); verts.push_back(v0);
        verts.push_back(px + charW);   verts.push_back(y + charH);    verts.push_back(u1); verts.push_back(v1);
        verts.push_back(px);           verts.push_back(y + charH);    verts.push_back(u0); verts.push_back(v1);

        px += charW;
    }

    if (verts.empty()) return;

    glBindVertexArray(fontVAO);
    glBindBuffer(GL_ARRAY_BUFFER, fontVBO);
    glBufferSubData(GL_ARRAY_BUFFER, 0, verts.size() * sizeof(float), verts.data());

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glDrawArrays(GL_TRIANGLES, 0, verts.size() / 4);
    glDisable(GL_BLEND);

    glBindVertexArray(0);
    glUseProgram(0);
}

void TextRenderer::destroy() {
    if (fontVAO) glDeleteVertexArrays(1, &fontVAO);
    if (fontVBO) glDeleteBuffers(1, &fontVBO);
    if (fontTex) glDeleteTextures(1, &fontTex);
    if (textShader) glDeleteProgram(textShader);
}
