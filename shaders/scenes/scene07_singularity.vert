#version 460 core
// SCENE 7: SINGULARITY GARDEN — Galaxy-scale particle rendering
// This vertex shader renders particles from an SSBO

#include "../common/noise.glsl"

struct Particle {
    vec4 pos;       // xyz=position, w=life
    vec4 vel;       // xyz=velocity, w=mass
    vec4 color;     // rgb=color, a=size
};

layout(std430, binding = 0) readonly buffer ParticleBuffer {
    Particle particles[];
};

out vec3 vColor;
out float vSize;
out float vLife;

uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
uniform float uProgress;

void main() {
    Particle p = particles[gl_VertexID];

    vColor = p.color.rgb;
    vSize  = p.color.a * (0.5 + 0.5 * sin(uTime * 2.0 + float(gl_VertexID) * 0.1));
    vLife  = p.pos.w;

    vec4 viewPos = uView * vec4(p.pos.xyz, 1.0);
    gl_Position  = uProj * viewPos;
    gl_PointSize = max(1.0, vSize * 300.0 / (-viewPos.z));
}
