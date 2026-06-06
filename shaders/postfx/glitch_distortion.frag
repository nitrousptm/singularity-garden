#version 460 core
// Glitch Distortion — enhanced RGB shift + wave displacement

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uTime;
uniform float uIntensity;    // 0..1, strength of glitch
uniform float uFrequency;    // wave frequency

// Pseudo random
float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUV;

    // Scanline-based glitch (horizontal only at certain y-ranges)
    float scanGlitch = hash(floor(vUV.y * 8.0) + uTime * 2.0);
    if (scanGlitch > 0.7 && uIntensity > 0.0) {
        uv.x += (hash(vUV.y * 10.0) - 0.5) * uIntensity * 0.08;
    }

    // Wave distortion
    uv.y += sin(uv.x * uFrequency + uTime * 2.0) * uIntensity * 0.02;
    uv.x += cos(uv.y * uFrequency * 0.7 + uTime * 1.5) * uIntensity * 0.015;

    // RGB separation (chromatic aberration on steroids)
    float aberration = uIntensity * 0.015;
    float r = texture(uScene, uv + vec2(aberration, 0.0)).r;
    float g = texture(uScene, uv).g;
    float b = texture(uScene, uv - vec2(aberration, 0.0)).b;

    vec3 col = vec3(r, g, b);

    // Random color shift on some scan lines
    if (mod(vUV.y * 100.0, 3.0) < 1.0 && uIntensity > 0.3) {
        col *= mix(vec3(1.0), vec3(hash(uTime), hash(uTime + 1.0), hash(uTime + 2.0)) * 1.5, 0.3);
    }

    fragColor = vec4(col, 1.0);
}
