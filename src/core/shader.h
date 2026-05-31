#pragma once
#include <glad/gl.h>
#include <glm/glm.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <string>
#include <unordered_map>

class Shader {
public:
    GLuint id = 0;

    Shader() = default;
    ~Shader() { if (id) glDeleteProgram(id); }
    Shader(const Shader&) = delete;
    Shader& operator=(const Shader&) = delete;
    Shader(Shader&& o) noexcept : id(o.id), uniformCache(std::move(o.uniformCache)) { o.id = 0; }
    Shader& operator=(Shader&& o) noexcept {
        if (id) glDeleteProgram(id);
        id = o.id; o.id = 0;
        uniformCache = std::move(o.uniformCache);
        return *this;
    }

    bool loadVF(const std::string& vertPath, const std::string& fragPath);
    bool loadVGF(const std::string& vertPath, const std::string& geomPath, const std::string& fragPath);
    bool loadCompute(const std::string& compPath);

    void use() const { glUseProgram(id); }

    void setInt(const char* name, int v)              const { glUniform1i(loc(name), v); }
    void setFloat(const char* name, float v)          const { glUniform1f(loc(name), v); }
    void setVec2(const char* name, const glm::vec2& v) const { glUniform2fv(loc(name), 1, glm::value_ptr(v)); }
    void setVec3(const char* name, const glm::vec3& v) const { glUniform3fv(loc(name), 1, glm::value_ptr(v)); }
    void setVec4(const char* name, const glm::vec4& v) const { glUniform4fv(loc(name), 1, glm::value_ptr(v)); }
    void setMat4(const char* name, const glm::mat4& m) const { glUniformMatrix4fv(loc(name), 1, GL_FALSE, glm::value_ptr(m)); }

private:
    mutable std::unordered_map<std::string, GLint> uniformCache;

    GLint loc(const char* name) const {
        auto it = uniformCache.find(name);
        if (it != uniformCache.end()) return it->second;
        GLint l = glGetUniformLocation(id, name);
        uniformCache[name] = l;
        return l;
    }

    static std::string loadFile(const std::string& path);
    static std::string preprocess(const std::string& src, const std::string& baseDir);
    static GLuint compile(GLenum type, const std::string& src, const std::string& label);
    static bool link(GLuint prog, const std::string& label);
};
