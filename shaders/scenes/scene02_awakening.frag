#version 460 core
// SCENE 2: AWAKENING CORE — Ultra-Complex Shader
// 0:20–0:45 @ 133 BPM — Monolith erwacht, Energie bricht aus
// Features: Raymarching, Tentakel-Filamente, Spektral-Dispersion,
//           Plasma-Portale, Beat-Shockwaves, Fraktal-Atmosphäre,
//           Neon-Energie-Ringe, Holy-Shit Explosion

#include "../common/noise.glsl"
#include "../common/sdf.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform float uHolyShitPhase;
uniform vec2  uResolution;

// ================================================================
// UTILITIES
// ================================================================
float easeInOut(float t) { return t * t * (3.0 - 2.0 * t); }

float beatPulse() {
    return uBeatStrength * max(0.0, 1.0 - uBeatPhase * 2.4);
}

// Rotationsmatrix Y
mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s,  0,1,0,  -s,0,c);
}

// ================================================================
// ENERGIE-TENTAKEL — organische Filamente vom Monolith
// ================================================================
float tentacleSDF(vec3 p, int idx, float t, float prog) {
    float fi = float(idx);
    float ang0 = fi * 2.3998 + 0.7;

    // Basis-Spirale
    float angSpeed = 0.18 + fi * 0.031 + beatPulse() * 0.12;
    float ang = ang0 + t * angSpeed;

    // Tentakel wächst aus Mitte und biegt sich
    float reach = prog * (2.8 + fi * 0.22) * (1.0 + beatPulse() * 0.28);
    vec3 tip = vec3(sin(ang) * reach, cos(fi * 0.85 + t * 0.25) * 1.4, cos(ang) * reach);

    // Domain-Warp für organische Biegung
    float warp = fbm3(p * 0.55 + t * 0.06 + fi * 1.7, 4, 2.0, 0.5) * 0.9;
    vec3 pw = p + vec3(warp, warp * 0.5, -warp) * prog;

    // SDF: Bezier-approximiert durch Segment
    vec3 a = vec3(0.0);
    vec3 b = tip;
    vec3 pa = pw - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float r = 0.04 + (1.0 - h) * 0.02 * prog;
    return length(pa - ba * h) - r * (1.0 + beatPulse() * 0.5);
}

// ================================================================
// PLASMA-PORTAL — geometrische Ringe mit SDF
// ================================================================
float portalRingSDF(vec3 p, float t, float prog) {
    float appears = smoothstep(0.30, 0.52, prog);
    if (appears < 0.001) return 1e9;

    // Torus, der auf Beat pulsiert
    float bigR = 3.8 * appears;
    float smallR = 0.06 + beatPulse() * 0.04;
    vec2 q = vec2(length(p.xz) - bigR, p.y + 0.2);
    float ring1 = length(q) - smallR;

    // Zweiter rotierter Ring
    vec3 p2 = p;
    p2.xz = rot2(t * 0.14) * p2.xz;
    p2.xy = rot2(t * 0.09) * p2.xy;
    vec2 q2 = vec2(length(p2.xz) - bigR * 0.7, p2.y);
    float ring2 = length(q2) - smallR * 0.7;

    return min(ring1, ring2);
}

// ================================================================
// SDF-SZENE
// ================================================================
vec2 sdScene(vec3 p) {
    // --- Monolith — dreht sich langsam mit Holy-Shit-Phase ---
    float hsRot = uHolyShitPhase * 2.8;
    vec3 mp = rotY(hsRot * 0.12) * p;
    float warp = fbm3(mp * 0.45 + vec3(uTime * 0.07, 0.0, uTime * 0.05), 4, 2.0, 0.5);
    mp = mp + vec3(warp, 0.0, warp) * uProgress * 0.38;
    mp = opTwist(mp + vec3(0.0, -1.0, 0.0), warp * 0.028 * uProgress + hsRot * 0.06);

    float surfRipple = sin(p.y * 3.2 - uTime * 22.0) * 0.018 * (1.0 - uBeatPhase) * uBeatStrength;
    float detail = fbm3(mp * 6.5 + uTime * 0.04, 5, 2.0, 0.5) * 0.06 * uProgress;

    // Holy-Shit: Monolith fragmentiert sich
    float fracture = 0.0;
    if (uHolyShitPhase > 0.0) {
        float frac = fbm3(mp * 12.0 + uTime * 0.15, 3, 2.0, 0.5);
        fracture = frac * uHolyShitPhase * 0.18;
    }
    float monolith = sdBox(mp, vec3(1.35, 6.8, 0.48)) + surfRipple + detail + fracture;

    // --- Energy Core ---
    float coreBase = 0.38 * smoothstep(0.0, 0.45, uProgress);
    float corePulse = 1.0 + 0.22 * (1.0 - uBeatPhase) * uBeatStrength
                         + uHolyShitPhase * 0.4;
    float core1 = sdSphere(p + vec3(0.0, -1.8, 0.0), coreBase * corePulse);
    float core2 = sdSphere(p + vec3(0.0,  0.3, 0.0), coreBase * 0.55 * corePulse);
    float core3 = sdSphere(p + vec3(0.0,  2.2, 0.0), coreBase * 0.28 * corePulse);
    float core  = smin(core1, smin(core2, core3, 0.65), 0.85);

    // --- Boden ---
    float hexRel = hexGrid(p.xz * 0.42 + 0.5, 11.0) * 0.07;
    float ground = p.y + 7.2 + hexRel;

    // --- Tentakel-Filamente ---
    float tentacles = 1e9;
    int numTent = 8 + int(uProgress * 6.0);  // wächst mit Progress
    for (int i = 0; i < 14; i++) {
        if (i >= numTent) break;
        tentacles = min(tentacles, tentacleSDF(p, i, uTime, uProgress));
    }

    // --- Portal-Ringe ---
    float portal = portalRingSDF(p, uTime, uProgress);

    // --- Debris ---
    float debris = 1e9;
    for (int i = 0; i < 16; i++) {
        float fi = float(i);
        float orbitBoost = 1.0 + uBeatStrength * 0.52 * (1.0 - uBeatPhase)
                               + uHolyShitPhase * 0.8;
        float ang = fi * 2.399 + uTime * (0.22 + fi * 0.025) * orbitBoost;
        float radius = 2.4 + fi * 0.15 + uHolyShitPhase * fi * 0.12;
        float height = cos(fi * 1.73 + uTime * (0.28 + fi * 0.018)) * 2.8 - 0.8;
        vec3 dpos = vec3(sin(ang) * radius, height, cos(ang) * radius);
        float dr = 0.05 + 0.09 * hash11(fi * 0.719);
        float appear = smoothstep(0.0, 0.55, uProgress - fi * 0.015);
        debris = min(debris, sdSphere(p - dpos, dr * appear));
    }

    vec2 res = sminMat(vec2(monolith,   1.0), vec2(core,      2.0), 0.4);
    res       = sminMat(res,            vec2(ground,    3.0), 0.2);
    res       = sminMat(res,            vec2(debris,    4.0), 0.1);
    res       = sminMat(res,            vec2(tentacles, 5.0), 0.08);
    res       = sminMat(res,            vec2(portal,    6.0), 0.05);
    return res;
}

// ================================================================
// RAYMARCHER
// ================================================================
vec2 rayMarch(vec3 ro, vec3 rd) {
    float t = 0.01, matID = 0.0;
    for (int i = 0; i < 128; i++) {
        vec2 h = sdScene(ro + rd * t);
        if (h.x < 0.0015) { matID = h.y; break; }
        if (t > 58.0) break;
        t += h.x * 0.86;
    }
    return vec2(t, matID);
}

vec3 calcNormal(vec3 p) {
    const float e = 0.0008;
    return normalize(vec3(
        sdScene(p+vec3(e,0,0)).x - sdScene(p-vec3(e,0,0)).x,
        sdScene(p+vec3(0,e,0)).x - sdScene(p-vec3(0,e,0)).x,
        sdScene(p+vec3(0,0,e)).x - sdScene(p-vec3(0,0,e)).x));
}

float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 6; i++) {
        float h = 0.01 + 0.16 * float(i) / 5.0;
        float d = sdScene(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.91;
    }
    return clamp(1.0 - 3.2 * occ, 0.0, 1.0);
}

// ================================================================
// VOLUMETRICS
// ================================================================
// God Rays mit Spektral-Dispersion (3-facher Sample für RGB)
vec3 godRaysSpectral(vec3 ro, vec3 rd, vec3 lightPos, float boost) {
    vec3 rays = vec3(0.0);
    float t = 0.3;
    for (int i = 0; i < 48; i++) {
        vec3 pos = ro + rd * t;
        float dist = length(pos - lightPos);
        float scatter = exp(-dist * 0.19) * (1.0 + boost * 2.2);
        float nv = vnoise3(pos * 1.3 + uTime * 0.06) * 0.6 + 0.4;
        float hf = exp(-abs(pos.y - lightPos.y) * 0.15);
        // Chromatische Dispersion: R/G/B leicht versetzt
        float dR = length((pos + rd * 0.08) - lightPos);
        float dB = length((pos - rd * 0.08) - lightPos);
        rays.r += exp(-dR * 0.19) * nv * hf * 0.022 * (1.0 + boost);
        rays.g += scatter * nv * hf * 0.022;
        rays.b += exp(-dB * 0.21) * nv * hf * 0.024 * (1.0 + boost * 0.8);
        t += 0.38 + float(i) * 0.006;
    }
    return rays;
}

// Energie-Wellen vom Core — mehrere konzentrische Ringe
float energyWaves(vec3 pos, float beatPhase, float beatStr, float t) {
    float coreY = -1.8;
    float r = length(vec2(pos.x, pos.z));
    float total = 0.0;

    // Mehrere Wellenringe pro Beat
    for (int i = 0; i < 4; i++) {
        float phase = fract(beatPhase + float(i) * 0.25);
        float waveR = phase * 22.0;
        float waveFront = abs(r - waveR) - 0.12 * (1.0 - phase);
        float wave = exp(-waveFront * waveFront * 24.0) * (1.0 - phase) * beatStr;
        float hMod = exp(-abs(pos.y - coreY) * 0.07);
        total += wave * hMod;
    }
    return total * 2.2;
}

// Atmosphärische Schichtung (Fraktal-Volumetric)
vec3 atmosphericFog(vec3 ro, vec3 rd, float tHit, float t) {
    vec3 fog = vec3(0.0);
    float stepSize = tHit / 12.0;
    float acc = 0.0;

    for (int i = 0; i < 12; i++) {
        float ti = stepSize * (float(i) + 0.5);
        vec3 pos = ro + rd * ti;
        float density = fbm3(pos * 0.18 + t * 0.04, 3, 2.0, 0.5);
        density = max(0.0, density - 0.35) * 2.0;
        float height = exp(-max(0.0, pos.y + 5.5) * 0.22);
        density *= height;

        vec3 c = mix(vec3(0.01, 0.03, 0.12),
                     vec3(0.08, 0.02, 0.22), density);
        fog += c * density * stepSize * 0.05 * (1.0 - acc);
        acc = min(1.0, acc + density * stepSize * 0.04);
    }
    return fog;
}

// Shockwave-Ring mit mehrfachen Obertönen
float shockwaveRing(vec3 pos, float beatPhase, float strength) {
    float total = 0.0;
    for (int h = 1; h <= 3; h++) {
        float radius = beatPhase * 18.0 / float(h);
        float ring   = abs(length(pos.xz) - radius);
        float width  = 0.28 + beatPhase * 0.7;
        total += exp(-ring / width) * (1.0 - beatPhase) * strength / float(h);
    }
    return total;
}

// ================================================================
// ATMOSPHÄRE
// ================================================================
vec3 skyColor(vec3 rd, float prog, float t) {
    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    // Basis-Gradient: tiefes Violett bis Schwarz
    vec3 hori = mix(vec3(0.018, 0.025, 0.10), vec3(0.055, 0.015, 0.22), prog);
    vec3 zen  = mix(vec3(0.000, 0.000, 0.028), vec3(0.010, 0.000, 0.12), prog);

    // Sterne
    vec3 starPos = rd * 200.0;
    float star1  = hash13(floor(starPos * 8.0));
    float star2  = hash13(floor(starPos * 22.0 + 1.7));
    float stars  = pow(max(0.0, star1 - 0.96), 3.0) * 18.0
                 + pow(max(0.0, star2 - 0.98), 3.0) * 32.0;
    float twinkle = sin(t * 3.1 + star1 * 17.0) * 0.5 + 0.5;
    stars *= (0.6 + twinkle * 0.4) * (1.0 - h * 1.2);

    return mix(hori, zen, pow(h, 0.32)) + stars * 0.5 * prog;
}

// ================================================================
// KINEMATISCHE KAMERA
// ================================================================
vec3 getCameraPos(float progress, float sceneTime, float beat) {
    float nudge = beat * 0.10;

    if (progress < 0.28) {
        float t = easeInOut(progress / 0.28);
        float height = mix(22.0, 8.0, t);
        float dist   = mix(1.2, 4.5, t);
        float ang    = sceneTime * 0.12;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    } else if (progress < 0.65) {
        float t = easeInOut((progress - 0.28) / 0.37);
        float height = mix(8.0, 1.6, t);
        float dist   = mix(4.5, 9.5, t);
        float ang    = sceneTime * 0.20 + 0.6;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    } else {
        float t = easeInOut((progress - 0.65) / 0.35);
        float height = mix(1.6, 6.0, t);
        float dist   = mix(9.5, 16.0 + uHolyShitPhase * 4.0, t);
        float ang    = sceneTime * 0.16 + 2.2;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    }
}

// ================================================================
// MATERIAL-SHADING
// ================================================================
vec3 shadeMaterial(float matID, vec3 pos, vec3 N, vec3 V,
                   vec3 lightPos, vec3 rimLightPos, vec3 fillPos,
                   float ao, float beat) {
    vec3 L    = normalize(lightPos    - pos);
    vec3 Lrim = normalize(rimLightPos - pos);
    vec3 Lfill= normalize(fillPos     - pos);
    float rim = pow(max(0.0, 1.0 - dot(N, V)), 2.6);
    float rimPulse = 1.0 + beat * 3.2;
    float hs = uHolyShitPhase;

    if (matID < 1.5) {
        // === MONOLITH — lebendiges Obsidian ===
        vec3 albedo = vec3(0.015, 0.015, 0.035);
        float rough = 0.18, metal = 0.98;

        vec3 mL  = vec3(0.55, 0.80, 1.0) * (4.5 + hs * 6.0);
        vec3 mRim= vec3(0.22, 0.42, 1.0) * (3.8 + beat * 4.0) * rimPulse;
        vec3 mFill=vec3(0.08, 0.14, 0.48) * 1.8;

        vec3 shade = cookTorrance(N, V, L,     albedo, metal, rough) * mL
                   + cookTorrance(N, V, Lrim,  albedo, metal, rough) * mRim
                   + cookTorrance(N, V, Lfill, albedo, metal, rough) * mFill;
        vec3 env = envLighting(N, V, albedo, metal, rough,
            mix(vec3(0.035,0.055,0.20), vec3(0.12,0.05,0.55), hs),
            vec3(0.008,0.008,0.030));

        // Multi-Layer Energie-Risse
        float crack1 = domainWarpFbm(pos * 2.8  + uTime * 0.09, 4);
        float crack2 = domainWarpFbm(pos * 5.5  - uTime * 0.07, 3);
        float crack3 = fbm3(pos * 12.0 + uTime * 0.15, 3, 2.0, 0.5);
        float cL1 = pow(max(0.0, crack1 - 0.40), 2.8) * pow(max(0.0, crack2 - 0.35), 2.0);
        float cL2 = pow(max(0.0, crack3 - 0.48), 3.5);
        float crackAmt = uProgress * (1.0 + beat * 0.7) * (1.0 + hs * 2.0);
        vec3 crackHue = mix(
            mix(vec3(0.0, 0.62, 1.0), vec3(0.55, 0.12, 1.0), uBarPhase),
            vec3(1.0, 0.35, 0.0), hs);
        vec3 emission = crackHue * (cL1 * 7.0 + cL2 * 4.0) * crackAmt;
        emission += crackHue * rim * rimPulse * uProgress * 1.4;

        // Holy-Shit: Monolith leuchtet wie eine Sonne
        emission += mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.5, 0.1), hs)
                  * hs * 8.0 * (0.5 + rim * 2.0);

        return shade + env * ao + emission;

    } else if (matID < 2.5) {
        // === ENERGY CORE — explodierendes Plasma ===
        vec3 hot  = mix(vec3(0.6, 0.9, 1.0), vec3(1.0, 0.95, 0.6),
                        sin(uTime * 4.2) * 0.5 + 0.5);
        vec3 cool = mix(vec3(0.0, 0.45, 1.0), vec3(0.42, 0.0, 1.0), uBarPhase);
        float pulse = 1.0 + 0.45 * (1.0 - uBeatPhase) * uBeatStrength;
        float glow  = fbm3(pos * 6.0 + uTime * 0.35, 3, 2.0, 0.5);

        // Fraktal-Wellen im Core
        float fracWave = sin(length(pos.xz) * 8.0 - uTime * 12.0) * 0.5 + 0.5;
        float coreIntensity = 10.0 + beat * 9.0 + hs * 20.0;

        return mix(cool, hot, glow * fracWave) * coreIntensity * pulse;

    } else if (matID < 3.5) {
        // === BODEN — Hex-Gitter mit Shockwaves ===
        vec3 albedo = vec3(0.025, 0.025, 0.048);
        float m = 0.84, r = 0.30;
        vec3 shade = cookTorrance(N, V, L, albedo, m, r) * vec3(0.5, 0.72, 1.0) * 3.5;
        vec3 env   = envLighting(N, V, albedo, m, r,
            vec3(0.018, 0.038, 0.14), vec3(0.006));
        float hexGlow = hexGrid(pos.xz * 0.42 + 0.5, 11.0);
        float shock   = shockwaveRing(pos, uBeatPhase, uBeatStrength);
        vec3 shockHue = mix(vec3(0.0, 0.5, 1.0), vec3(0.5, 0.0, 1.0), uBarPhase);
        float hexBeat = hexGlow * (0.55 + beat * 0.9) * uProgress;
        return shade + env * ao
            + vec3(0.0, 0.55, 1.0) * hexBeat
            + shockHue * shock * 2.5
            + shockHue * hs * hexGlow * 2.0;

    } else if (matID < 4.5) {
        // === DEBRIS — pulsierende Energie-Fragmente ===
        float dH = hash12(pos.xy + pos.z * 0.37);
        vec3 dCol= mix(vec3(0.12, 0.52, 1.0), vec3(0.72, 0.18, 1.0), dH);
        float dP = 1.0 + beat * dH * 2.0 + hs * 3.0;
        return dCol * (4.0 + dP * 3.0) + dCol * rim * 3.0;

    } else if (matID < 5.5) {
        // === TENTAKEL-FILAMENTE — Neon-Energie ===
        float h2 = hash13(floor(pos * 5.5));
        vec3 tc = mix(vec3(0.0, 1.0, 0.6), vec3(0.8, 0.1, 1.0), h2);
        float tP = 1.0 + beat * 1.8 + hs * 4.0;
        float tGlow = fbm3(pos * 4.0 + uTime * 0.2, 2, 2.0, 0.5);
        return tc * (5.0 + tP * 3.5) * (0.6 + tGlow * 0.8);

    } else {
        // === PORTAL-RINGE ===
        float pHash = hash13(floor(pos * 3.0));
        vec3 pCol = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.2, 0.8), sin(uTime * 1.5) * 0.5 + 0.5);
        float pP  = 1.0 + beat * 2.5 + hs * 5.0;
        return pCol * (8.0 + pP * 4.0);
    }
}

// ================================================================
// MAIN
// ================================================================
void main() {
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    float beat = beatPulse();

    // === KAMERA ===
    vec3 ro     = getCameraPos(uProgress, uSceneTime, beat);
    vec3 target = vec3(0.0, 0.8, 0.0);
    vec3 fwd    = normalize(target - ro);
    vec3 right  = normalize(cross(fwd, vec3(0,1,0)));
    vec3 up_    = cross(right, fwd);

    float fovDeg = 50.0 + uProgress * 18.0 + uHolyShitPhase * 12.0;
    float fovTan = tan(radians(fovDeg) * 0.5);

    // BPM-Shake + Holy-Shit Jitter
    float shakeAmt = beat * 0.014 + uHolyShitPhase * 0.025;
    vec2 shakeOff = vec2(
        sin(uTime * 83.0) * shakeAmt,
        cos(uTime * 71.0) * shakeAmt);

    // Spektrale Dispersion: Ray leicht versetzt für R/G/B
    float dispersion = 0.003 + uHolyShitPhase * 0.008;
    vec3 rdG = normalize(fwd
        + (ndc.x + shakeOff.x)           * right * fovTan
        + (ndc.y + shakeOff.y)           * up_   * fovTan);
    vec3 rdR = normalize(fwd
        + (ndc.x + shakeOff.x + dispersion) * right * fovTan
        + (ndc.y + shakeOff.y)              * up_   * fovTan);
    vec3 rdB = normalize(fwd
        + (ndc.x + shakeOff.x - dispersion) * right * fovTan
        + (ndc.y + shakeOff.y)              * up_   * fovTan);

    vec3 col = vec3(0.0);

    // === MULTI-SPECTRAL RAYMARCHING ===
    vec2 hitG = rayMarch(ro, rdG);
    vec2 hitR = rayMarch(ro, rdR);
    vec2 hitB = rayMarch(ro, rdB);

    vec3 lightPos    = vec3(5.0 * sin(uTime * 0.24), 9.0, 5.0 * cos(uTime * 0.24));
    vec3 rimLightPos = vec3(-lightPos.x * 0.85, lightPos.y * 0.38, -lightPos.z * 0.85);
    vec3 fillPos     = vec3(0.0, -2.5, 9.0);

    // Shade G-channel (Haupt-Ray)
    if (hitG.y > 0.0 && hitG.x < 58.0) {
        vec3 posG = ro + rdG * hitG.x;
        vec3 NG   = calcNormal(posG);
        float aoG = calcAO(posG, NG);
        vec3 gC = shadeMaterial(hitG.y, posG, NG, -rdG, lightPos, rimLightPos, fillPos, aoG, beat);
        col.g = gC.g;
        // Auch R und B shaden
        vec3 posR = ro + rdR * hitR.x;
        vec3 posB = ro + rdB * hitB.x;
        if (hitR.y > 0.0 && hitR.x < 58.0) {
            vec3 NR = calcNormal(posR);
            col.r = shadeMaterial(hitR.y, posR, NR, -rdR, lightPos, rimLightPos, fillPos, calcAO(posR, NR), beat).r;
        } else {
            col.r = skyColor(rdR, uProgress, uTime).r;
        }
        if (hitB.y > 0.0 && hitB.x < 58.0) {
            vec3 NB = calcNormal(posB);
            col.b = shadeMaterial(hitB.y, posB, NB, -rdB, lightPos, rimLightPos, fillPos, calcAO(posB, NB), beat).b;
        } else {
            col.b = skyColor(rdB, uProgress, uTime).b;
        }
        col.gb = gC.gb; // G und B aus Haupt-Shading, nur R spektral

        // Nebel
        float fog = 1.0 - exp(-hitG.x * 0.012);
        col = mix(col, skyColor(rdG, uProgress, uTime), fog);
    } else {
        col = skyColor(rdG, uProgress, uTime);
    }

    // === VOLUMETRISCHE GOD RAYS (spektral) ===
    vec3 rays1 = godRaysSpectral(ro, rdG, vec3(0.0, -1.0, 0.0), beat);
    vec3 rays2 = godRaysSpectral(ro, rdG, vec3(0.0,  6.8, 0.0), beat * 0.5)
               * smoothstep(0.32, 0.72, uProgress);
    vec3 rayHue = mix(vec3(0.18, 0.58, 1.0), vec3(0.42, 0.10, 1.0), uBarPhase);
    col += rayHue * rays1 * uProgress * 4.0;
    col += vec3(0.22, 0.45, 1.0) * rays2 * 2.2;

    // === ENERGIE-WELLEN ===
    float waves = energyWaves(ro + rdG * hitG.x * 0.5, uBeatPhase, uBeatStrength, uTime);
    vec3 waveHue = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.15, 1.0), uBarPhase * 0.7);
    col += waveHue * waves * 5.5;

    // === ATMOSPHÄRISCHER NEBEL ===
    col += atmosphericFog(ro, rdG, min(hitG.x, 55.0), uTime);

    // === HOLY-SHIT EFFEKTE ===
    if (uHolyShitPhase > 0.0) {
        float hs = uHolyShitPhase;

        // Radiale Lichtexplosion
        float radDist = length(vUV - 0.5);
        float radGlow = exp(-radDist * (3.0 - hs * 2.5)) * hs;
        vec3 radHue = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.3, 0.1), hs);
        col += radHue * radGlow * 6.0;

        // Energie-Ring-Explosion
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float ringPhase = fract(uBarPhase + fi * 0.2);
            float ringR = radDist;
            float ringW = 0.01 + hs * 0.05;
            float ringTarget = (0.1 + fi * 0.12) * hs;
            float rg = exp(-abs(ringR - ringTarget) / ringW) * hs;
            vec3 rHue = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.2, 0.8), fi * 0.2);
            col += rHue * rg * 4.0;
        }

        // Screen-Chromatic-Aberration
        vec2 distDir = (vUV - 0.5) * hs;
        col.r = mix(col.r, col.r * (1.0 + length(distDir) * 0.5), hs * 0.4);
        col.b = mix(col.b, col.b * (1.0 + length(distDir) * 0.5), hs * 0.4);
    }

    // === BPM FLASHES ===
    float barFlash  = pow(max(0.0, 1.0 - uBarPhase  * 6.5), 3.2) * 0.5
                    * smoothstep(0.22, 0.50, uProgress);
    float beatFlash = pow(max(0.0, 1.0 - uBeatPhase * 5.0), 4.0) * 0.28 * uBeatStrength;
    vec3 flashHue   = mix(vec3(0.25, 0.55, 1.0), vec3(0.5, 0.10, 1.0), uBarPhase);
    col += flashHue * (barFlash + beatFlash);

    // === VIGNETTE ===
    vec2 vig = (vUV - 0.5) * 2.0;
    float vigStr = 0.30 + uHolyShitPhase * 0.15;
    col *= 1.0 - dot(vig, vig) * vigStr;

    // === FADE IN (sanft, kein weißes Flash am Anfang) ===
    float fadeIn = smoothstep(0.0, 0.08, uProgress);
    col *= fadeIn;

    fragColor = vec4(col, 1.0);
}
