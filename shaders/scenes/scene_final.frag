#version 460 core
// SCENE FINAL: SILENCE & ASCENSION — agentix logo, single light impulse, fade to black
// Duration: 3:50 - 4:00 (10 seconds)

#include "../common/noise.glsl"
#include "../common/sdf.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;   // 0..1 (last 10 seconds)
uniform float uBeatPhase;
uniform vec2  uResolution;
uniform sampler2D uPrevScene;  // last rendered frame for echo effect

// -------- SDF text: "AGENTIX" (stylized as signed-distance glyphs) --------
// Simplified: construct logo as geometric SDF composition

float sdLetter_A(vec2 p) {
    p.x = abs(p.x);
    float leftEdge = abs(p.x - (-0.5 + p.y * 0.5)) - 0.04;
    float topBar   = sdBox(vec3(p, 0.0), vec3(0.08, 0.04, 1.0));
    float crossBar = abs(p.y - 0.3) - 0.03;
    crossBar = max(crossBar, abs(p.x) - 0.25);
    float d = min(leftEdge, crossBar);
    float inside = abs(length(p) - 0.5) - 0.05;
    return min(d, inside);
}

float logoSDF(vec2 p) {
    // "agentix" text approximation via stacked boxes with cutouts
    // A stylized diamond/hexagon shape with circuit lines
    p *= 2.0;  // scale

    float hex  = sdHexPrism(vec3(p, 0.0), vec2(0.5, 0.1));
    float inner = sdHexPrism(vec3(p, 0.0), vec2(0.35, 0.2));

    // Circuit lines radiating from center
    float lines = 1e10;
    for (int i = 0; i < 6; i++) {
        float ang = float(i) * 3.14159 / 3.0;
        vec2  dir = vec2(cos(ang), sin(ang));
        // Line from hex edge outward
        vec2  lp  = p - dir * 0.6;
        float seg = length(lp - dir * clamp(dot(lp, dir), 0.0, 0.3)) - 0.02;
        lines = min(lines, seg);
    }

    float d = max(hex, -inner);  // ring
    d = min(d, lines);

    // Center diamond
    float diamond = sdOctahedron(vec3(p * 0.8, 0.0), 0.25);
    d = min(d, diamond);

    // AGENTIX text below (very simplified)
    vec2 tp = p - vec2(0.0, -0.8);
    float text = sdBox(vec3(tp, 0.0), vec3(0.7, 0.08, 1.0));
    // Simulate letter gaps
    for (int i = -3; i <= 3; i++) {
        float gap = abs(tp.x - float(i) * 0.18) - 0.03;
        text = max(text, -max(abs(tp.x - float(i)*0.18) - 0.04, abs(tp.y) - 0.09));
    }
    d = min(d, text);

    return d;
}

// -------- Recursive echo (all scenes echoing into black) --------
vec3 recursiveEcho(vec2 uv, float t) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < 5; i++) {
        float scale = 1.0 - float(i) * 0.12;
        float alpha = pow(0.6, float(i)) * (1.0 - t);
        vec2 scaled = (uv - 0.5) / scale + 0.5;
        if (scaled.x >= 0.0 && scaled.x <= 1.0 && scaled.y >= 0.0 && scaled.y <= 1.0)
            col += texture(uPrevScene, scaled).rgb * alpha;
    }
    return col;
}

void main() {
    vec2 uv = vUV;
    float fadeOut  = 1.0 - smoothstep(0.6, 1.0, uProgress);  // fade to black at end
    float fadeIn   = smoothstep(0.0, 0.15, uProgress);         // quick fade in

    // Recursive echoes of all previous scenes collapsing to center
    vec3 col = recursiveEcho(uv, uProgress) * fadeOut;

    // Silence pulse: single slow energy wave
    float waveDist = length(uv - 0.5);
    float waveT    = uProgress * 2.0;
    float wave     = exp(-pow(waveDist - waveT * 0.4, 2.0) * 50.0) * (1.0 - uProgress);
    col += vec3(0.6, 0.9, 1.0) * wave * 2.0;

    // Logo reveal: emerges from the convergence
    float logoAppear = smoothstep(0.15, 0.45, uProgress) * smoothstep(1.0, 0.75, uProgress);
    float logoScale  = mix(0.3, 0.18, uProgress);
    vec2  logoUV     = (uv - 0.5) / logoScale;
    float logoDist   = logoSDF(logoUV);
    float logoEdge   = smoothstep(0.01, -0.01, logoDist);
    float logoGlow   = exp(-max(logoDist, 0.0) * 6.0) * 0.6;

    // Logo color: starts white-hot, cools to cyan
    vec3 logoColor = mix(vec3(1.0, 0.95, 0.9), vec3(0.2, 0.8, 1.0), uProgress);
    col += (logoEdge + logoGlow) * logoColor * logoAppear;

    // "Built by agentix" glow ring around logo
    float ring = abs(length(uv - 0.5) - logoScale * 1.2) - 0.005;
    float ringGlow = exp(-max(ring, 0.0) * 80.0) * logoAppear * 0.5;
    col += vec3(0.2, 0.6, 1.0) * ringGlow;

    // Particles fading to logo — tiny stars falling inward
    for (int i = 0; i < 20; i++) {
        float phase = fract(uProgress * 2.0 + float(i) * 0.05);
        float ang   = float(i) * 2.0 * 3.14159 / 20.0;
        float r     = mix(0.6, 0.0, phase);
        vec2  pPos  = vec2(cos(ang), sin(ang)) * r + 0.5;
        float pDist = length(uv - pPos);
        col += exp(-pDist * 200.0) * mix(vec3(0.3,0.7,1.0), logoColor, phase) * (1.0 - phase);
    }

    // Final "light impulse" flash at progress=0.5
    float lightImpulse = exp(-pow(uProgress - 0.5, 2.0) * 200.0) * 3.0;
    col += vec3(1.0) * lightImpulse;

    // Apply fade in/out
    col *= fadeIn * fadeOut;

    // Film grain
    float grain = hash12(uv + vec2(uTime * 0.0317, uTime * 0.0271)) - 0.5;
    col += grain * 0.02 * (1.0 - uProgress);

    fragColor = vec4(col, 1.0);
}
