#include "core/framebuffer.h"
#include <cstdio>

bool Framebuffer::create(int w, int h, const std::vector<Attachment>& attachments, bool withDepth) {
    destroy();
    width = w; height = h;
    colorAttachments = attachments;

    glGenFramebuffers(1, &fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);

    std::vector<GLenum> drawBufs;
    for (int i = 0; i < (int)colorAttachments.size(); ++i) {
        auto& a = colorAttachments[i];
        glGenTextures(1, &a.tex);
        glBindTexture(GL_TEXTURE_2D, a.tex);
        glTexImage2D(GL_TEXTURE_2D, 0, a.internalFmt, w, h, 0, a.fmt, a.type, nullptr);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, a.tex, 0);
        drawBufs.push_back(GL_COLOR_ATTACHMENT0 + i);
    }
    glDrawBuffers((GLsizei)drawBufs.size(), drawBufs.data());

    if (withDepth) {
        glGenTextures(1, &depthTex);
        glBindTexture(GL_TEXTURE_2D, depthTex);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT32F, w, h, 0, GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthTex, 0);
    }

    GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    if (status != GL_FRAMEBUFFER_COMPLETE) {
        fprintf(stderr, "[FBO] Incomplete framebuffer: 0x%X\n", status);
        destroy();
        return false;
    }
    return true;
}

void Framebuffer::destroy() {
    for (auto& a : colorAttachments)
        if (a.tex) { glDeleteTextures(1, &a.tex); a.tex = 0; }
    colorAttachments.clear();
    if (depthTex) { glDeleteTextures(1, &depthTex); depthTex = 0; }
    if (fbo) { glDeleteFramebuffers(1, &fbo); fbo = 0; }
}

bool PingPong::create(int w, int h, const std::vector<Attachment>& att, bool depth) {
    return fbo[0].create(w, h, att, depth) && fbo[1].create(w, h, att, depth);
}
