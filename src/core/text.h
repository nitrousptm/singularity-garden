#pragma once
#include <glad/gl.h>
#include <glm/glm.hpp>
#include <string>

// Screen-space text renderer using a 5x7 bitmap font encoded in a 1D texture.
// Font data is column-major: each char = 5 bytes, bit 0 = top row.
class TextRenderer {
public:
    bool init(int screenW, int screenH);
    void destroy();

    // Draw text at screen position (pixels, origin = bottom-left).
    // scale: font size multiplier (1 = 5x7 px, 2 = 10x14 px, ...)
    void draw(const std::string& text, float x, float y, float scale = 3.0f);
    void setColor(glm::vec3 c) { color = c; }

private:
    GLuint shader    = 0;
    GLuint vao       = 0;
    GLuint vbo       = 0;
    GLuint fontTex   = 0; // 1D texture: 96 chars * 5 bytes = 480 texels (R8)
    int    sw = 1920, sh = 1080;
    glm::vec3 color = glm::vec3(0.9f, 0.9f, 1.0f);

    void buildFontTexture();
};
