#pragma once
#include <glad/gl.h>
#include <vector>

struct Attachment {
    GLuint tex = 0;
    GLenum internalFmt;
    GLenum fmt;
    GLenum type;
};

class Framebuffer {
public:
    GLuint fbo = 0;
    int width = 0, height = 0;
    std::vector<Attachment> colorAttachments;
    GLuint depthTex = 0;

    Framebuffer() = default;
    ~Framebuffer() { destroy(); }
    Framebuffer(const Framebuffer&) = delete;
    Framebuffer& operator=(const Framebuffer&) = delete;

    // e.g. create({GL_RGBA16F, GL_RGBA, GL_FLOAT}, {GL_RG16F, GL_RG, GL_FLOAT}) with depth
    bool create(int w, int h,
                const std::vector<Attachment>& attachments,
                bool withDepth = true);

    void bind() const   { glBindFramebuffer(GL_FRAMEBUFFER, fbo); }
    void unbind() const { glBindFramebuffer(GL_FRAMEBUFFER, 0); }

    void bindColorTex(int attachment, int unit) const {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, colorAttachments[attachment].tex);
    }
    void bindDepthTex(int unit) const {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, depthTex);
    }

    void destroy();
};

// Simple ping-pong helper
struct PingPong {
    Framebuffer fbo[2];
    int cur = 0;

    bool create(int w, int h, const std::vector<Attachment>& att, bool depth = false);
    Framebuffer& write()     { return fbo[cur]; }
    Framebuffer& read()      { return fbo[1 - cur]; }
    void swap()              { cur = 1 - cur; }
};
