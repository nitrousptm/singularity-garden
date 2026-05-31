#version 460 core
// SCENE 4: TIME FRACTURE — Temporal Reality Dissolving
// Duration: 1:15 - 1:45 (30 seconds)
// Reprojection feedback, multiple time slices, kaleidoscope

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;   // 0..1
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;
uniform sampler2D uPrevFrame;  // feedback texture

// -------- Complex number ops --------
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }

// -------- Julia set --------
float julia(vec2 z, vec2 c) {
    float r2 = 0.0;
    int i;
    for (i = 0; i < 64; i++) {
        z = cmul(z, z) + c;
        r2 = dot(z, z);
        if (r2 > 4.0) break;
    }
    return float(i) / 64.0 - log2(log2(r2)) / 64.0;
}

// -------- Screen tear / glitch --------
vec2 glitchUV(vec2 uv, float t, float intensity) {
    float line = floor(uv.y * 40.0);
    float glitchRow = step(0.97, hash12(vec2(line * 0.01, floor(t * 20.0))));
    float shift = (hash12(vec2(line, floor(t * 30.0))) - 0.5) * intensity * glitchRow;
    uv.x = fract(uv.x + shift);

    // Digital block corruption
    vec2 block = floor(uv * 16.0) / 16.0;
    float blockCorrupt = step(0.95, hash12(block + floor(t * 15.0)));
    uv += (hash22(block + t) - 0.5) * 0.04 * blockCorrupt * intensity;

    return uv;
}

// -------- Kaleidoscope --------
vec2 kaleidoscope(vec2 uv, int segments, float rotation) {
    vec2 p = uv - 0.5;
    float angle = atan(p.y, p.x) + rotation;
    float r = length(p);
    float segAngle = 3.14159 * 2.0 / float(segments);
    angle = mod(angle, segAngle);
    if (angle > segAngle * 0.5) angle = segAngle - angle;
    return vec2(cos(angle), sin(angle)) * r + 0.5;
}

// -------- Temporal ghosting --------
vec3 temporalSlice(vec2 uv, float timeOffset, float alpha) {
    // Sample from slightly different time slices (simulated)
    float t = uTime + timeOffset;
    vec2 c = vec2(sin(t * 0.3) * 0.5, cos(t * 0.4) * 0.5);  // Julia parameter
    vec2 z = (uv * 2.0 - 1.0) * 2.5;
    float j = julia(z, c);

    vec3 past  = mix(vec3(0.05, 0.1, 0.3), vec3(0.8, 0.2, 0.5), j);
    vec3 ghost = past * (1.0 - abs(timeOffset) * 0.2);
    return ghost * alpha;
}

// -------- Reality fracture lines --------
float fractureLines(vec2 uv, float t) {
    vec2 p = uv * 3.0;
    float angle = atan(p.y - 1.5, p.x - 1.5) + t * 0.1;
    float r = length(p - vec2(1.5));
    float spiral = sin(angle * 7.0 - r * 4.0 + t * 2.0);
    float crack = smoothstep(0.0, 0.02, abs(spiral));
    return 1.0 - crack;
}

// -------- Wormhole effect --------
vec3 wormhole(vec2 uv, float t) {
    vec2 p = uv - 0.5;
    float r = length(p);
    float theta = atan(p.y, p.x);

    // Spiral inward
    float spiral = theta + r * 5.0 - t * 2.0;
    float stripes = sin(spiral * 8.0) * 0.5 + 0.5;

    // Tunnel rings
    float rings = sin(r * 30.0 - t * 4.0) * 0.5 + 0.5;

    float lensR = 1.0 / (1.0 + r * r * 4.0);
    vec3 col = mix(vec3(0.05, 0.0, 0.1), vec3(0.5, 0.1, 1.0), stripes * rings);
    return col * lensR;
}

void main() {
    vec2 uv = vUV;
    float intensity = smoothstep(0.0, 0.2, uProgress) * mix(1.0, 1.5, uBeatStrength);

    // Glitch the UV
    vec2 glitchedUV = glitchUV(uv, uTime, intensity * 0.5);

    // Julia set base (shifting parameter with beat)
    float beatInfluence = uBeatStrength * 0.3;
    vec2 juliaC = vec2(
        -0.7 + sin(uTime * 0.2 + beatInfluence) * 0.3,
         0.27 + cos(uTime * 0.3) * 0.2
    );
    vec2 z = (glitchedUV * 2.0 - 1.0) * 2.5;
    z.x *= uResolution.x / uResolution.y;
    float j = julia(z, juliaC);

    // Kaleidoscope mirror effect
    int kSegs = 6 + int(uProgress * 4.0);
    vec2 kUV = kaleidoscope(glitchedUV, kSegs, uTime * 0.05);
    float jk = julia((kUV * 2.0 - 1.0) * 2.5, juliaC);

    // Primary color: temporal fracture palette
    vec3 col = mix(
        vec3(0.0, 0.1, 0.4),
        vec3(0.7, 0.0, 1.0),
        j);
    col = mix(col, mix(vec3(0.0, 0.6, 0.5), vec3(1.0, 0.2, 0.0), jk), 0.4);

    // Multiple time slice ghosts
    col += temporalSlice(glitchedUV, -0.5, 0.15 * uProgress);
    col += temporalSlice(glitchedUV, -1.2, 0.10 * uProgress);
    col += temporalSlice(glitchedUV,  0.8, 0.12 * uProgress);

    // Feedback (temporal accumulation)
    vec3 feedback = texture(uPrevFrame, glitchedUV + vec2(0.0, 0.001)).rgb;
    col = mix(col, feedback, 0.3 * uProgress);

    // Fracture lines
    float fracLines = fractureLines(uv, uTime);
    col *= mix(1.0, fracLines * 0.5 + 0.5, 0.4 * uProgress);
    col += vec3(0.5, 0.1, 1.0) * (1.0 - fracLines) * 0.3 * uProgress;

    // Wormhole center
    float wormholeStrength = smoothstep(0.5, 1.0, uProgress);
    vec3 wh = wormhole(uv, uTime);
    col = mix(col, wh, wormholeStrength * 0.4);

    // Beat flash (reality shattering)
    float beatFlash = pow(1.0 - uBeatPhase, 6.0) * uBeatStrength;
    col += vec3(1.0, 0.3, 0.8) * beatFlash * 0.8;
    col = mix(col, vec3(1.0), beatFlash * 0.15 * (uBeatStrength > 0.9 ? 1.0 : 0.0));

    // Screen distortion pulse
    float pulse = sin(uTime * 133.0 / 60.0 * 3.14159 * 2.0) * 0.5 + 0.5;
    col += vec3(0.1, 0.0, 0.2) * pulse * uBeatStrength * 0.3;

    // Vignette + chromatic abberation at edges
    vec2 edge = (uv - 0.5) * 2.0;
    float vign = 1.0 - dot(edge, edge) * 0.3;
    col *= vign;

    fragColor = vec4(col, 1.0);
}
