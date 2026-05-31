#version 460 core
// SCENE 3: Nasse Stadtstrasse — Vertex Shader

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;

uniform mat4  uView;
uniform mat4  uProj;
uniform float uTime;
uniform float uProgress;

void main() {
    // Boden liegt bei Y = -7.0
    vec3 worldPos = vec3(aPos.x, -7.0, aPos.z);
    vWorldPos = worldPos;
    vNormal   = vec3(0.0, 1.0, 0.0);
    vUV       = aUV;
    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
