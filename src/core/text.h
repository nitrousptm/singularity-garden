#pragma once
#include <glad/gl.h>
#include <glm/glm.hpp>
#include <string>

// Simple bitmap-based text renderer for scene names
class TextRenderer {
public:
    bool init();
    void destroy();

    // Draw text at screen-space position (0,0 = bottom-left in normalized coords [-1,1])
    // pos: normalized device coords, size: font size in pixels (roughly)
    void draw(const std::string& text, float x, float y, float size);

    // Set text color (0..1 range)
    void setColor(glm::vec3 color) { textColor = color; }

private:
    GLuint fontTex = 0;
    GLuint fontVAO = 0, fontVBO = 0;
    GLuint textShader = 0;
    glm::vec3 textColor = glm::vec3(0.95f, 0.95f, 0.95f);

    // Simple font metrics: 16x8 character grid (ASCII 32-127)
    static constexpr int FONT_CHARS_X = 16;
    static constexpr int FONT_CHARS_Y = 6;  // Only 96 printable ASCII

    void createFontTexture();
};
