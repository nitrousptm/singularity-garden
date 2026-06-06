#version 460 core
// Atmospheric Glow — adds volumetric haze and god rays effect

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uTime;
uniform float uIntensity;    // 0..1
uniform vec3 uLightDir;      // light direction (normalized)
uniform vec3 uLightColor;    // light color

// Volumetric sampling
const int SAMPLES = 16;
const float SAMPLE_LENGTH = 0.02;

float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUV;
    vec3 scene = texture(uScene, uv).rgb;
    vec3 bloom = texture(uBloom, uv).rgb;

    // God rays from center outward (simulate light passing through screen)
    vec2 center = vec2(0.5, 0.3);  // slightly off-center
    vec2 rayDir = normalize(uv - center);
    float dist = distance(uv, center);

    // Volumetric haze
    vec3 haze = vec3(0.0);
    vec2 samplePos = center;
    for (int i = 0; i < SAMPLES; i++) {
        samplePos += rayDir * SAMPLE_LENGTH;
        if (samplePos.x < 0.0 || samplePos.x > 1.0 || samplePos.y < 0.0 || samplePos.y > 1.0)
            break;

        vec3 sampleColor = texture(uScene, samplePos).rgb;
        float brightness = dot(sampleColor, vec3(0.299, 0.587, 0.114));
        haze += brightness * uLightColor * 0.02;
    }

    // Falloff
    float falloff = exp(-dist * dist * 2.0);
    haze *= falloff * uIntensity;

    // Combine
    vec3 result = scene + haze + bloom * (1.0 + uIntensity * 0.5);

    fragColor = vec4(result, 1.0);
}
