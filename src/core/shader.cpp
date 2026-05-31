#include "core/shader.h"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <cstdio>

namespace fs = std::filesystem;

std::string Shader::loadFile(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) {
        fprintf(stderr, "[Shader] Cannot open: %s\n", path.c_str());
        return "";
    }
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

std::string Shader::preprocess(const std::string& src, const std::string& baseDir) {
    std::istringstream in(src);
    std::ostringstream out;
    std::string line;
    while (std::getline(in, line)) {
        if (line.rfind("#include", 0) == 0) {
            auto a = line.find('"');
            auto b = line.rfind('"');
            if (a != std::string::npos && b != a) {
                std::string incPath = baseDir + "/" + line.substr(a + 1, b - a - 1);
                std::string incSrc = loadFile(incPath);
                out << preprocess(incSrc, fs::path(incPath).parent_path().string()) << "\n";
                continue;
            }
        }
        out << line << "\n";
    }
    return out.str();
}

GLuint Shader::compile(GLenum type, const std::string& src, const std::string& label) {
    GLuint s = glCreateShader(type);
    const char* c = src.c_str();
    glShaderSource(s, 1, &c, nullptr);
    glCompileShader(s);
    GLint ok;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char buf[4096];
        glGetShaderInfoLog(s, sizeof(buf), nullptr, buf);
        fprintf(stderr, "[Shader] Compile error in %s:\n%s\n", label.c_str(), buf);
        glDeleteShader(s);
        return 0;
    }
    return s;
}

bool Shader::link(GLuint prog, const std::string& label) {
    glLinkProgram(prog);
    GLint ok;
    glGetProgramiv(prog, GL_LINK_STATUS, &ok);
    if (!ok) {
        char buf[4096];
        glGetProgramInfoLog(prog, sizeof(buf), nullptr, buf);
        fprintf(stderr, "[Shader] Link error in %s:\n%s\n", label.c_str(), buf);
        return false;
    }
    return true;
}

bool Shader::loadVF(const std::string& vertPath, const std::string& fragPath) {
    std::string baseDir = fs::path(vertPath).parent_path().string();
    std::string vsrc = preprocess(loadFile(vertPath), baseDir);
    std::string fsrc = preprocess(loadFile(fragPath), fs::path(fragPath).parent_path().string());

    GLuint vs = compile(GL_VERTEX_SHADER, vsrc, vertPath);
    GLuint fs_ = compile(GL_FRAGMENT_SHADER, fsrc, fragPath);
    if (!vs || !fs_) { glDeleteShader(vs); glDeleteShader(fs_); return false; }

    if (id) glDeleteProgram(id);
    id = glCreateProgram();
    glAttachShader(id, vs);
    glAttachShader(id, fs_);
    bool ok = link(id, vertPath + " + " + fragPath);
    glDeleteShader(vs);
    glDeleteShader(fs_);
    if (!ok) { glDeleteProgram(id); id = 0; }
    return ok;
}

bool Shader::loadVGF(const std::string& vertPath, const std::string& geomPath, const std::string& fragPath) {
    std::string vsrc = preprocess(loadFile(vertPath), fs::path(vertPath).parent_path().string());
    std::string gsrc = preprocess(loadFile(geomPath), fs::path(geomPath).parent_path().string());
    std::string fsrc = preprocess(loadFile(fragPath), fs::path(fragPath).parent_path().string());

    GLuint vs = compile(GL_VERTEX_SHADER,   vsrc, vertPath);
    GLuint gs = compile(GL_GEOMETRY_SHADER, gsrc, geomPath);
    GLuint fs_ = compile(GL_FRAGMENT_SHADER, fsrc, fragPath);
    if (!vs || !gs || !fs_) {
        glDeleteShader(vs); glDeleteShader(gs); glDeleteShader(fs_);
        return false;
    }

    if (id) glDeleteProgram(id);
    id = glCreateProgram();
    glAttachShader(id, vs); glAttachShader(id, gs); glAttachShader(id, fs_);
    bool ok = link(id, geomPath);
    glDeleteShader(vs); glDeleteShader(gs); glDeleteShader(fs_);
    if (!ok) { glDeleteProgram(id); id = 0; }
    return ok;
}

bool Shader::loadCompute(const std::string& compPath) {
    std::string csrc = preprocess(loadFile(compPath), fs::path(compPath).parent_path().string());
    GLuint cs = compile(GL_COMPUTE_SHADER, csrc, compPath);
    if (!cs) return false;

    if (id) glDeleteProgram(id);
    id = glCreateProgram();
    glAttachShader(id, cs);
    bool ok = link(id, compPath);
    glDeleteShader(cs);
    if (!ok) { glDeleteProgram(id); id = 0; }
    return ok;
}
