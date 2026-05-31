#version 460 core
// SCENE 7: SINGULARITY GARDEN — Galaxy-scale particle fragment
// + full volumetric nebula background

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in vec3 vColor;
in float vSize;
in float vLife;

out vec4 fragColor;

uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;

void main() {
    // Soft particle disk
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;

    // Glow falloff
    float glow = exp(-r * 3.0);

    // Color: hot-core white, cool-edge nebula color
    vec3 coreColor  = vec3(1.0, 0.95, 0.85);
    vec3 edgeColor  = vColor;
    vec3 col = mix(coreColor, edgeColor, r);
    col *= glow;

    // Brightness modulation: twinkle + beat pulse
    float twinkle = 0.8 + 0.2 * sin(uTime * 3.7 + vLife * 27.3);
    float beatMod  = 1.0 + 0.3 * pow(1.0 - uBeatPhase, 8.0) * uBeatStrength;
    col *= twinkle * beatMod;

    // Life-based alpha (particles fade in/out)
    float alpha = glow * clamp(vLife, 0.0, 1.0) * 0.8;

    fragColor = vec4(col, alpha);
}
