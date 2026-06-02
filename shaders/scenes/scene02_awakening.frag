#version 460 core
// SCENE 2: AWAKENING CORE — Monolith, Energy Core, Tentacles, Debris
// Duration: 0:20 - 0:50 (30 seconds)
// 133 BPM beat-synced

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
// SECTION 1: EXTENDED UTILITY FUNCTIONS
// ================================================================

float easeInOut(float t) {
    return t * t * (3.0 - 2.0 * t);
}

float easeIn(float t) {
    return t * t;
}

float easeOut(float t) {
    return 1.0 - (1.0 - t) * (1.0 - t);
}

float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
}

float beatPulse() {
    return uBeatStrength * max(0.0, 1.0 - uBeatPhase * 2.5);
}

float beatPulseSharp() {
    return uBeatStrength * pow(max(0.0, 1.0 - uBeatPhase * 4.0), 3.0);
}

float barPulse() {
    return uBeatStrength * max(0.0, 1.0 - uBarPhase * 1.8);
}

mat3 rotX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1.0, 0.0, 0.0,
                0.0,   c,  -s,
                0.0,   s,   c);
}

mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(  c, 0.0,   s,
                0.0, 1.0, 0.0,
                 -s, 0.0,   c);
}

mat3 rotZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(  c,  -s, 0.0,
                  s,   c, 0.0,
                0.0, 0.0, 1.0);
}

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

float cabs(vec2 z) {
    return length(z);
}

float carg(vec2 z) {
    return atan(z.y, z.x);
}

vec2 cpow(vec2 z, float n) {
    float r = pow(length(z), n);
    float theta = atan(z.y, z.x) * n;
    return vec2(r * cos(theta), r * sin(theta));
}

float remap01(float v, float lo, float hi) {
    return clamp((v - lo) / (hi - lo), 0.0, 1.0);
}

float impulse(float k, float x) {
    float h = k * x;
    return h * exp(1.0 - h);
}

float cubicPulse(float c, float w, float x) {
    x = abs(x - c);
    if (x > w) return 0.0;
    x /= w;
    return 1.0 - x * x * (3.0 - 2.0 * x);
}

float almostIdentity(float x, float m, float n) {
    if (x > m) return x;
    float a = 2.0 * n - m;
    float b = 2.0 * m - 3.0 * n;
    float t = x / m;
    return (a * t + b) * t * t + n;
}

vec3 hsvToRgb(vec3 hsv) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsv.y);
}

float signedAngleMod(float a) {
    return mod(a + PI, 2.0 * PI) - PI;
}

// ================================================================
// SECTION 2: FRACTAL DETAIL FUNCTIONS
// ================================================================

vec2 juliaSet2D(vec2 pos, vec2 seed) {
    vec2 z = pos;
    float trap = 1e9;
    float n = 0.0;
    for (int i = 0; i < 64; i++) {
        z = cmul(z, z) + seed;
        float d = dot(z, z);
        trap = min(trap, abs(d - 1.5));
        if (d > 4.0) {
            n = float(i) - log2(log2(d)) + 4.0;
            break;
        }
        n = float(i);
    }
    return vec2(n / 64.0, trap);
}

float mandelbrot(vec2 c) {
    vec2 z = vec2(0.0);
    float n = 0.0;
    for (int i = 0; i < 128; i++) {
        z = cmul(z, z) + c;
        if (dot(z, z) > 4.0) {
            float sl = float(i) - log2(log2(dot(z, z))) + 4.0;
            n = sl / 128.0;
            break;
        }
        n = float(i) / 128.0;
    }
    return n;
}

float fbmDomainWarped3D(vec3 p, float warpAmt, int oct) {
    vec3 q = p + vec3(
        fbm3(p + vec3(0.0, 0.0, 0.0), oct, 2.0, 0.5),
        fbm3(p + vec3(5.2, 1.3, 2.7), oct, 2.0, 0.5),
        fbm3(p + vec3(1.7, 9.2, 3.8), oct, 2.0, 0.5)
    ) * warpAmt;

    vec3 r = q + vec3(
        fbm3(q + vec3(1.7, 9.2, 0.5), oct, 2.0, 0.5),
        fbm3(q + vec3(8.3, 2.8, 1.2), oct, 2.0, 0.5),
        fbm3(q + vec3(4.1, 6.5, 7.3), oct, 2.0, 0.5)
    ) * warpAmt * 0.5;

    return fbm3(r, oct, 2.0, 0.5);
}

float noisePattern(vec3 p, float freq, float t) {
    vec3 pp = p * freq;
    float warp1 = fbm3(pp + vec3(t * 0.11, 0.0, t * 0.09), 3, 2.0, 0.5);
    float warp2 = fbm3(pp + vec3(warp1) + vec3(t * 0.07), 2, 2.0, 0.5);
    vec3 warped = pp + vec3(warp1 * 0.6, warp2 * 0.4, warp1 * 0.3);
    float base  = fbm3(warped + t * 0.05, 4, 2.0, 0.5);
    float detail = vnoise3(warped * 3.0 + t * 0.13) * 0.25;
    return base + detail;
}

float spiralNoise(vec3 p, float t) {
    float r = length(p.xz);
    float angle = atan(p.z, p.x);
    float spiralPhase = angle / (2.0 * PI) + r * 0.4 - t * 0.3;
    float s = sin(spiralPhase * 8.0) * 0.5 + 0.5;
    float n = vnoise3(p * 1.8 + t * 0.08);
    return s * n;
}

float turbulence(vec3 p, int oct) {
    float val = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int i = 0; i < oct; i++) {
        val += abs(vnoise3(p * freq) * 2.0 - 1.0) * amp;
        amp  *= 0.5;
        freq *= 2.0;
    }
    return val;
}

float ridgedFbm(vec3 p, int oct) {
    float val  = 0.0;
    float amp  = 0.5;
    float freq = 1.0;
    float prev = 1.0;
    for (int i = 0; i < oct; i++) {
        float n = 1.0 - abs(vnoise3(p * freq) * 2.0 - 1.0);
        n = n * n * prev;
        prev = n;
        val  += n * amp;
        amp  *= 0.5;
        freq *= 2.0;
    }
    return val;
}

// ================================================================
// SECTION 3: EXTENDED SDF SCENE
// ================================================================

// --- Crystal spire helper ---
float sdSpire(vec3 p, float height, float baseR) {
    float cone = sdCone(p, baseR / height, height);
    float cap  = sdSphere(p - vec3(0.0, height, 0.0), baseR * 0.3);
    return smin(cone, cap, 0.1);
}

// --- Fractal debris shapes ---
float sdDebrisRock(vec3 p, float seed) {
    float base = sdOctahedron(p, 1.0);
    float bump = fbm3(p * 3.7 + seed, 2, 2.0, 0.5) * 0.22;
    return base + bump;
}

vec2 sdScene(vec3 p) {
    // ---- MONOLITH ----
    float warp1 = fbm3(p * 0.45 + vec3(uTime * 0.07, 0.0, uTime * 0.05), 4, 2.0, 0.5);
    float warp2 = fbm3(p * 0.90 + vec3(uTime * 0.04, uTime * 0.06, 0.0), 3, 2.0, 0.5);
    float warp3 = domainWarpFbm(p * 0.3 + uTime * 0.03, 3);
    vec3 mp = p + vec3(warp1, 0.0, warp1) * uProgress * 0.35
                + vec3(-warp2 * 0.15, warp2 * 0.1, warp3 * 0.12) * uProgress * 0.2;
    mp = rotY(uHolyShitPhase * 0.18) * mp;
    mp = rotX(sin(uTime * 0.11) * 0.008 * uProgress) * mp;
    mp = opTwist(mp + vec3(0.0, -1.0, 0.0),
                 warp1 * 0.024 * uProgress + uHolyShitPhase * 0.08);

    float surfRipple = sin(p.y * 3.0 - uTime * 20.0) * 0.018 * (1.0 - uBeatPhase) * uBeatStrength;
    float surfRipple2= sin(p.x * 5.5 + uTime * 14.0) * 0.010 * beatPulse();
    float detail     = fbm3(mp * 5.8  + uTime * 0.03, 3, 2.0, 0.5) * 0.05  * uProgress;
    float detail2    = fbm3(mp * 11.0 - uTime * 0.05, 2, 2.0, 0.5) * 0.028 * uProgress;
    float detail3    = ridgedFbm(mp * 22.0, 2) * 0.014 * uProgress;
    float fracture   = fbm3(mp * 11.0 + uTime * 0.12, 2, 2.0, 0.5) * uHolyShitPhase * 0.14;
    float fracture2  = turbulence(mp * 8.0 + uTime * 0.09, 2) * uHolyShitPhase * 0.06;

    // Circuit-like engravings via fbm thresholding
    float circuitBase  = fbm3(mp * 18.0 + vec3(0.0, uTime * 0.04, 0.0), 3, 2.0, 0.5);
    float circuitLine1 = abs(circuitBase - 0.5) - 0.012;
    float circuitLine2 = abs(fbm3(mp * 26.0, 2, 2.0, 0.5) - 0.48) - 0.008;
    float circuits     = min(circuitLine1, circuitLine2) * 0.06 * uProgress;

    float monolith = sdBox(mp, vec3(1.35, 6.8, 0.48))
                   + surfRipple + surfRipple2
                   + detail + detail2 + detail3
                   + fracture + fracture2
                   - circuits;

    // ---- ENERGY CORE: 5 spheres ----
    float coreR  = 0.38 * smoothstep(0.0, 0.45, uProgress);
    float cPulse = 1.0 + 0.20 * (1.0 - uBeatPhase) * uBeatStrength;
    float cPulse2= 1.0 + 0.12 * sin(uTime * 7.3 + 1.2);
    float core1  = sdSphere(p + vec3(0.0, -1.8,  0.0), coreR * cPulse);
    float core2  = sdSphere(p + vec3(0.0,  0.3,  0.0), coreR * 0.55 * cPulse * cPulse2);
    float core3  = sdSphere(p + vec3(0.0,  2.2,  0.0), coreR * 0.28 * cPulse);
    float core4  = sdSphere(p + vec3(sin(uTime * 2.1) * 0.35, -0.7, cos(uTime * 2.1) * 0.35),
                            coreR * 0.40 * cPulse2);
    float core5  = sdSphere(p + vec3(sin(uTime * 1.7 + 2.1) * 0.28, 1.2, cos(uTime * 1.7 + 2.1) * 0.28),
                            coreR * 0.33 * cPulse);
    float core = smin(core1,
               smin(core2,
               smin(core3,
               smin(core4, core5, 0.5), 0.55), 0.65), 0.85);

    // ---- GROUND: hex grid + Voronoi cracks + concentric pulse rings ----
    float hexRel     = hexGrid(p.xz * 0.42 + 0.5, 11.0) * 0.07;
    vec2  voronoiRes = voronoi2(p.xz * 0.85 + vec2(0.3, 0.7));
    float crack      = (1.0 - smoothstep(0.0, 0.08, voronoiRes.x)) * 0.055 * uProgress;
    float radDist    = length(p.xz);
    float pulseRing1 = exp(-pow(radDist - fract(uBeatPhase) * 18.0, 2.0) * 8.0) * uBeatStrength * 0.04;
    float pulseRing2 = exp(-pow(radDist - fract(uBeatPhase + 0.5) * 18.0, 2.0) * 8.0) * uBeatStrength * 0.025;
    float groundFbm  = fbm3(vec3(p.x, 0.0, p.z) * 0.18 + uTime * 0.02, 3, 2.0, 0.5) * 0.3;
    float ground = p.y + 7.2 + hexRel - crack + pulseRing1 + pulseRing2 + groundFbm * 0.15;

    // ---- 14 TENTACLES ----
    float tentacles = 1e9;
    for (int i = 0; i < 14; i++) {
        float fi   = float(i);
        float ang  = fi * 2.399 + uTime * (0.18 + fi * 0.022) * (1.0 + beatPulse() * 0.10);
        float reach= uProgress * (2.0 + fi * 0.22 + sin(fi * 1.33) * 0.4);
        float hOff = cos(fi * 0.85 + uTime * 0.22) * (1.2 + fi * 0.08);
        float spiral = sin(fi * 0.55 + uTime * 0.35) * 0.6 * uProgress;
        vec3 tip   = vec3(sin(ang + spiral) * reach,
                          hOff,
                          cos(ang + spiral) * reach);
        float w    = fbm3(p * 0.4 + uTime * 0.05 + fi * 1.5, 2, 2.0, 0.5) * 0.55;
        float w2   = vnoise3(p * 1.2 - uTime * 0.08 + fi * 2.3) * 0.22;
        vec3  pw   = p + vec3(w, w * 0.4, -w) * uProgress
                      + vec3(-w2, w2 * 0.3, w2) * uProgress * 0.5;
        vec3 ba    = tip;
        float h    = clamp(dot(pw, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
        float r    = 0.038 + (1.0 - h) * 0.025 * uProgress
                           + sin(h * 12.0 + uTime * 3.0 + fi) * 0.004 * uProgress;
        tentacles  = min(tentacles, length(pw - ba * h) - r);
    }

    // ---- 20 DEBRIS ----
    float debris = 1e9;
    for (int i = 0; i < 20; i++) {
        float fi   = float(i);
        float ang  = fi * 2.399 + uTime * (0.22 + fi * 0.020) * (1.0 + beatPulse() * 0.45);
        float radius = 2.3 + fi * 0.14 + uHolyShitPhase * fi * 0.09;
        float height = cos(fi * 1.73 + uTime * (0.28 + fi * 0.015)) * 2.8 - 0.8;
        vec3  dpos = vec3(sin(ang) * radius, height, cos(ang) * radius);
        float dr   = 0.04 + 0.10 * hash11(fi * 0.719);
        float appear = smoothstep(0.0, 0.55, uProgress - fi * 0.014);
        float spin = uTime * (0.5 + hash11(fi * 0.331) * 1.5);
        vec3 dp2   = rotY(spin) * rotX(spin * 0.7) * (p - dpos);
        float dSdf = sdDebrisRock(dp2, fi * 3.14) * 0.7;
        debris = min(debris, dSdf * appear + (1.0 - appear) * 1e9 - dr * appear);
    }
    debris = max(debris, 0.0);

    // ---- 8 CRYSTAL SPIRES ----
    float spires = 1e9;
    for (int i = 0; i < 8; i++) {
        float fi    = float(i);
        float ang   = fi * (2.0 * PI / 8.0) + 0.22;
        float rad   = 4.5 + sin(fi * 1.3) * 1.2;
        float h2    = 1.8 + fi * 0.35 + sin(fi * 0.77) * 0.6;
        h2 *= smoothstep(0.05, 0.85, uProgress - fi * 0.04);
        vec3 sp    = p - vec3(sin(ang) * rad, -7.2 + h2 * 0.5, cos(ang) * rad);
        mat3 tiltR = rotZ(sin(ang) * 0.12) * rotX(cos(ang) * 0.10);
        sp = tiltR * sp;
        float baseW = 0.18 + sin(fi * 0.9) * 0.06;
        float crystal = sdSpire(sp, h2, baseW);
        float cNoise  = fbm3(sp * 4.5 + uTime * 0.05, 2, 2.0, 0.5) * 0.04;
        spires = min(spires, crystal + cNoise);
    }

    // ---- 4 ENERGY RINGS (sdTorus) ----
    float rings = 1e9;
    for (int i = 0; i < 4; i++) {
        float fi   = float(i);
        float orbitAng = uTime * (0.28 + fi * 0.09) + fi * (PI * 0.5);
        float orbitR   = 2.2 + fi * 0.55;
        float orbitH   = sin(uTime * (0.4 + fi * 0.07) + fi) * 1.5;
        vec3 rCenter   = vec3(sin(orbitAng) * orbitR, orbitH, cos(orbitAng) * orbitR);
        vec3 rp        = p - rCenter;
        mat3 rRot      = rotX(orbitAng * 0.7) * rotZ(fi * 0.5);
        rp = rRot * rp;
        float torusR   = 0.55 + sin(fi * 1.1 + uTime * 0.8) * 0.12;
        float torusTube= 0.035 + beatPulse() * 0.018;
        float ring     = sdTorus(rp, vec2(torusR, torusTube));
        ring *= smoothstep(0.0, 0.4, uProgress - fi * 0.08);
        rings = min(rings, ring);
    }

    // ---- FRACTAL DUST: repeated-space particles ----
    vec3 dustP   = fract(p * 1.8 + vec3(uTime * 0.04, uTime * 0.03, uTime * 0.05)) - 0.5;
    float dustD  = length(dustP) - (0.018 + vnoise3(p * 2.2 + uTime * 0.07) * 0.012);
    dustD += (1.0 - uProgress) * 2.0;
    float dustMask = smoothstep(-5.5, -2.0, p.y) * (1.0 - smoothstep(8.0, 14.0, length(p)));

    // ---- COMBINE ----
    vec2 res = sminMat(vec2(monolith, 1.0),  vec2(core,     2.0), 0.40);
    res       = sminMat(res,                  vec2(ground,   3.0), 0.20);
    res       = sminMat(res,                  vec2(debris,   4.0), 0.10);
    res       = sminMat(res,                  vec2(tentacles,5.0), 0.08);
    res       = sminMat(res,                  vec2(spires,   6.0), 0.12);
    res       = sminMat(res,                  vec2(rings,    7.0), 0.06);
    if (dustMask > 0.01) {
        res   = sminMat(res,                  vec2(dustD,    8.0), 0.03);
    }
    return res;
}

// ================================================================
// SECTION 4: EXTENDED RAYMARCHER
// ================================================================

vec3 rayMarch(vec3 ro, vec3 rd) {
    float t   = 0.01;
    float mat = 0.0;
    float ao  = 1.0;
    float prevDist = 1e9;
    float stepScale = 0.92;

    for (int i = 0; i < 128; i++) {
        vec3  pos = ro + rd * t;
        vec2  h   = sdScene(pos);
        float d   = h.x;

        if (d < 0.0015) {
            mat = h.y;
            ao  = clamp(float(i) / 128.0, 0.0, 1.0);
            ao  = 1.0 - ao * 0.55;
            break;
        }
        if (t > 60.0) break;

        float adaptScale = stepScale;
        if (d > 2.0) adaptScale = min(0.98, stepScale + 0.05);
        if (d > 6.0) adaptScale = min(0.99, stepScale + 0.08);

        t += d * adaptScale;
        prevDist = d;
    }
    return vec3(t, mat, ao);
}

vec3 calcNormal(vec3 p) {
    const float e = 0.001;
    return normalize(vec3(
        sdScene(p + vec3( e, 0, 0)).x - sdScene(p - vec3( e, 0, 0)).x,
        sdScene(p + vec3( 0, e, 0)).x - sdScene(p - vec3( 0, e, 0)).x,
        sdScene(p + vec3( 0, 0, e)).x - sdScene(p - vec3( 0, 0, e)).x
    ));
}

float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca  = 1.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float h  = 0.008 + 0.18 * fi / 7.0;
        float d  = sdScene(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.88;
    }
    return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

float calcShadow(vec3 ro, vec3 rd, float tmin, float tmax) {
    float sh  = 1.0;
    float t   = tmin;
    float ph  = 1e10;
    for (int i = 0; i < 48; i++) {
        float d = sdScene(ro + rd * t).x;
        float y = d * d / (2.0 * ph);
        float dd= sqrt(d * d - y * y);
        sh = min(sh, 16.0 * dd / max(0.0001, t - y));
        ph = d;
        t += clamp(d, 0.01, 0.25);
        if (sh < 0.001 || t > tmax) break;
    }
    return clamp(sh, 0.0, 1.0);
}

// ================================================================
// SECTION 5: VOLUMETRIC EFFECTS
// ================================================================

vec3 volumetricFog(vec3 ro, vec3 rd, float tHit, float t) {
    vec3  fog     = vec3(0.0);
    float transmit= 1.0;
    float stepSize= tHit / 32.0;

    for (int i = 0; i < 32; i++) {
        float tt  = (float(i) + 0.5) * stepSize;
        if (tt >= tHit) break;
        vec3  pos  = ro + rd * tt;
        float dens = fbm3(pos * 0.22 + vec3(t * 0.04, 0.0, t * 0.03), 3, 2.0, 0.5);
        dens *= smoothstep(-7.5, 2.0, pos.y) * (1.0 - smoothstep(2.0, 9.0, pos.y));
        dens *= 0.045;
        if (dens < 0.0001) continue;

        float scatter = dens * exp(-dens * 4.0);
        vec3 fogCol = mix(vec3(0.01, 0.02, 0.10), vec3(0.04, 0.01, 0.18), uProgress);
        fogCol = mix(fogCol, vec3(0.15, 0.03, 0.30), uHolyShitPhase);
        float beerLambertAtten = exp(-transmit * dens * stepSize * 3.0);
        fog      += fogCol * scatter * transmit * stepSize;
        transmit *= beerLambertAtten;
        if (transmit < 0.01) break;
    }
    return fog;
}

vec3 godRays(vec3 ro, vec3 rd, vec3 lp, float boost) {
    vec3  rays = vec3(0.0);
    float t2   = 0.3;
    for (int i = 0; i < 48; i++) {
        vec3  pos  = ro + rd * t2;
        float dist = length(pos - lp);
        float sc   = exp(-dist * 0.18) * (1.0 + boost * 1.8);
        float nv   = vnoise3(pos * 1.3 + uTime * 0.06) * 0.55 + 0.45;
        float nv2  = vnoise3(pos * 2.8 - uTime * 0.04) * 0.30 + 0.35;
        float hf   = exp(-abs(pos.y - lp.y) * 0.14);
        vec3  rayCol = mix(vec3(0.6, 0.5, 1.0), vec3(1.0, 0.3, 0.8), uBarPhase);
        rayCol = mix(rayCol, vec3(1.0, 0.5, 0.1), uHolyShitPhase * 0.7);
        rays  += rayCol * sc * nv * nv2 * hf * 0.018;
        t2    += 0.44;
    }
    return rays;
}

float energyWaves(vec3 p, float beatPhase, float beatStr) {
    float r     = length(p.xz);
    float total = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi  = float(i);
        float ph  = fract(beatPhase + fi * 0.2);
        float wR  = ph * 22.0;
        float amp = (1.0 - ph) * (1.0 - fi * 0.12);
        total += exp(-pow(r - wR, 2.0) * 18.0) * amp * beatStr;
    }
    return total * 2.2;
}

float shockwaveRing(vec3 pos, float beatPhase, float strength) {
    float total = 0.0;
    for (int h = 1; h <= 5; h++) {
        float fh     = float(h);
        float radius = beatPhase * 18.0 / fh;
        float ring   = abs(length(pos.xz) - radius);
        float w      = 0.24 + beatPhase * 0.50;
        float decay  = 1.0 - beatPhase;
        total += exp(-ring / w) * decay * strength / fh;
    }
    return total;
}

float causticsPattern(vec3 pos, float t) {
    vec2 p2 = pos.xz * 0.8;
    float c = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi  = float(i);
        vec2 sp   = p2 + vec2(sin(t * 0.3 + fi * 1.57), cos(t * 0.27 + fi * 2.09)) * 1.5;
        float wave= sin(length(sp) * 5.0 - t * 2.0 + fi * 1.1);
        c += wave * 0.25;
    }
    c = pow(max(0.0, c), 2.5) * 0.5;
    return c * smoothstep(-7.5, -6.8, pos.y) * (1.0 - smoothstep(-6.8, -4.0, pos.y));
}

// ================================================================
// SECTION 6: SURFACE DETAIL FUNCTIONS
// ================================================================

float monolithEngraving(vec3 p, float t) {
    float circuit1 = abs(fbm3(p * 18.0 + t * 0.03, 3, 2.0, 0.5) - 0.50) - 0.012;
    float circuit2 = abs(fbm3(p * 30.0 + t * 0.05, 2, 2.0, 0.5) - 0.48) - 0.008;
    float circuit3 = abs(sin(p.y * 14.0 + t * 0.8)  * 0.5 + 0.5 - 0.45) - 0.025;
    float circuit4 = abs(sin(p.x * 22.0 + t * 0.4)  * 0.5 + 0.5 - 0.47) - 0.018;
    float merged   = min(min(circuit1, circuit2), min(circuit3, circuit4));
    float glow     = pow(max(0.0, 1.0 - abs(merged) * 50.0), 2.5);
    glow *= fbm3(p * 9.0 + t * 0.06, 2, 2.0, 0.5) * 0.8 + 0.2;
    return glow * uProgress;
}

float crystalVein(vec3 p, float t) {
    float vein1 = abs(fbm3(p * 12.0 + t * 0.04, 3, 2.0, 0.5) - 0.52) - 0.015;
    float vein2 = abs(vnoise3(p * 20.0 - t * 0.03) - 0.50) - 0.010;
    float vein3 = ridgedFbm(p * 8.0 + t * 0.02, 3);
    float merged= max(0.0, min(vein1, vein2));
    float glow  = pow(max(0.0, 1.0 - abs(merged) * 60.0), 2.0);
    glow = mix(glow, glow * vein3, 0.5);
    return glow;
}

vec3 surfaceIridescence(vec3 N, vec3 V, float t) {
    float vdotn  = clamp(dot(V, N), 0.0, 1.0);
    float film   = vdotn * 3.14 + t * 0.5;
    vec3 irrid   = vec3(
        sin(film * 2.0) * 0.5 + 0.5,
        sin(film * 2.0 + 2.094) * 0.5 + 0.5,
        sin(film * 2.0 + 4.189) * 0.5 + 0.5
    );
    float fresnelFactor = pow(1.0 - vdotn, 3.0);
    return irrid * fresnelFactor * 0.7;
}

vec3 tentacleGlow(vec3 p, float t, int idx) {
    float fi  = float(idx);
    float hue = fract(fi * 0.137 + uBarPhase * 0.25);
    float sat = 0.8 + sin(fi * 1.3) * 0.15;
    float val = 1.0;
    vec3  baseCol = hsvToRgb(vec3(hue, sat, val));
    float pulse   = 1.0 + sin(t * (3.0 + fi * 0.4) + fi * 2.0) * 0.35;
    float gNoise  = fbm3(p * 5.0 + t * 0.15 + fi * 1.7, 2, 2.0, 0.5);
    float beat    = beatPulse() * 0.5 + 0.5;
    return baseCol * pulse * (0.7 + gNoise * 0.5) * beat;
}

vec3 debrisGlow(vec3 p, float matSeed, float t) {
    float h   = hash12(vec2(matSeed, floor(matSeed * 7.13)));
    float hue = fract(h * 2.0 + uBarPhase * 0.3);
    vec3  col = hsvToRgb(vec3(hue, 0.85, 1.0));
    float pulse = 1.0 + sin(t * (2.5 + h * 3.0)) * 0.4;
    return col * pulse;
}

vec3 crystalSpireColor(vec3 p, float t, int idx) {
    float fi  = float(idx);
    float hue = fract(0.58 + fi * 0.09 + uBarPhase * 0.15);
    vec3  col = hsvToRgb(vec3(hue, 0.7, 1.0));
    float vein= crystalVein(p, t);
    vec3  vCol= mix(col, vec3(1.0), 0.6);
    return mix(col * 0.4, vCol * 2.5, vein);
}

vec3 energyRingColor(vec3 p, float t, int idx) {
    float fi  = float(idx);
    float hue = fract(0.62 + fi * 0.11 + t * 0.04);
    vec3  base= hsvToRgb(vec3(hue, 0.9, 1.0));
    float bp  = beatPulse();
    float pulse = 1.0 + bp * 1.5;
    return base * pulse * (2.5 + uHolyShitPhase * 2.0);
}

// ================================================================
// SECTION 7: SKY AND ATMOSPHERE
// ================================================================

vec3 skyColor(vec3 rd, float prog) {
    float h    = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3  hori = mix(vec3(0.018, 0.022, 0.10), vec3(0.048, 0.012, 0.20), prog);
    vec3  zen  = mix(vec3(0.000, 0.000, 0.025), vec3(0.008, 0.000, 0.10), prog);
    vec3  base = mix(hori, zen, pow(h, 0.35));

    // Stars with scintillation
    float s1       = hash13(floor(rd * 180.0 + 0.5));
    float scintFreq= hash13(floor(rd * 180.0 + 1.5)) * 8.0 + 2.0;
    float scintAmp = hash13(floor(rd * 180.0 + 2.5)) * 0.4;
    float scint    = 1.0 + sin(uTime * scintFreq) * scintAmp;
    float starBase = pow(max(0.0, s1 - 0.97), 2.0) * 22.0 * (1.0 - h * 1.3);
    float stars    = starBase * scint * prog * 0.5;

    // Nebula background
    vec3 nebP      = rd * 2.0;
    float neb1     = fbm3(nebP * 0.8 + uTime * 0.003, 4, 2.0, 0.5);
    float neb2     = fbm3(nebP * 1.4 + vec3(3.2, 1.1, 2.5) + uTime * 0.002, 3, 2.0, 0.5);
    vec3  nebCol1  = vec3(0.02, 0.005, 0.08) * pow(neb1, 2.5);
    vec3  nebCol2  = vec3(0.005, 0.015, 0.06) * pow(neb2, 2.0);
    vec3  nebula   = (nebCol1 + nebCol2) * prog * 0.8;

    // Aurora-like energy bands at high progress
    float auroraStrength = smoothstep(0.5, 0.9, prog) * (0.5 + uHolyShitPhase * 0.8);
    float aurH     = rd.y;
    float aurBand1 = exp(-pow(aurH - 0.35, 2.0) * 30.0);
    float aurBand2 = exp(-pow(aurH - 0.52, 2.0) * 20.0);
    float aurWave  = sin(rd.x * 6.0 + uTime * 0.5) * 0.5 + 0.5;
    float aurWave2 = sin(rd.z * 5.0 - uTime * 0.4 + 1.2) * 0.5 + 0.5;
    vec3  auroraCol= mix(vec3(0.0, 0.4, 1.0), vec3(0.6, 0.0, 1.0), uBarPhase);
    vec3  aurora   = auroraCol * (aurBand1 * aurWave + aurBand2 * aurWave2) * auroraStrength * 0.25;

    // Moving clouds at low progress
    float cloudStr = smoothstep(0.3, 0.0, prog);
    float cld1     = fbm3(vec3(rd.xz * 3.0, uTime * 0.05), 3, 2.0, 0.5);
    float cld2     = fbm3(vec3(rd.xz * 5.0 + 2.1, uTime * 0.04 + 1.3), 2, 2.0, 0.5);
    float cloudMask= smoothstep(0.0, 0.5, h) * (1.0 - h);
    vec3  clouds   = vec3(0.005, 0.005, 0.012) * (cld1 * 0.6 + cld2 * 0.4) * cloudMask * cloudStr;

    return base + stars + nebula + aurora + clouds;
}

vec3 atmosphericScatter(vec3 rd, float prog) {
    float cosAngle = clamp(rd.y, 0.0, 1.0);
    float rayleigh = pow(1.0 - cosAngle, 3.0);
    vec3  scatter  = mix(vec3(0.002, 0.004, 0.020), vec3(0.006, 0.002, 0.018), prog);
    scatter = mix(scatter, vec3(0.012, 0.002, 0.024), uHolyShitPhase);
    return scatter * rayleigh;
}

// ================================================================
// SECTION 8: CAMERA
// ================================================================

vec3 getCamPos(float prog, float st, float beat) {
    float nudge = beat * 0.09;

    // Holy-shit dolly zoom influence
    float dollZoom = uHolyShitPhase * 0.8;

    if (prog < 0.28) {
        float t2   = easeInOutCubic(prog / 0.28);
        float baseD= mix(1.2, 4.5, t2);
        float shake= sin(st * 97.3) * beat * 0.06 + cos(st * 71.7) * beat * 0.04;
        return vec3(
            sin(st * 0.12) * (baseD + dollZoom) + nudge + shake,
            mix(22.0, 8.0, t2) + dollZoom * 0.5,
            cos(st * 0.12) * (baseD + dollZoom)
        );
    } else if (prog < 0.65) {
        float t2   = easeInOut((prog - 0.28) / 0.37);
        float ang  = st * 0.20 + 0.6;
        float rad  = mix(4.5, 9.5, t2);
        float shakeX = sin(st * 113.0) * beat * 0.05;
        float shakeY = cos(st * 83.0)  * beat * 0.04;
        float camY   = mix(8.0, 1.6, t2);

        // More complex path: figure-8 wobble
        float figureEight = sin(st * 0.08) * cos(st * 0.04) * 0.6 * t2;
        return vec3(
            sin(ang + figureEight) * (rad + dollZoom * 1.5) + nudge + shakeX,
            camY + shakeY + dollZoom * 1.2,
            cos(ang + figureEight) * (rad + dollZoom * 1.5)
        );
    } else {
        float t2   = easeOut((prog - 0.65) / 0.35);
        float ang  = st * 0.16 + 2.2;
        float d    = mix(9.5, 16.0 + uHolyShitPhase * 3.0, t2);

        // Spiral pull-back
        float spiral= sin(st * 0.10 + t2 * PI) * 0.8 * t2;
        float shakeX= sin(st * 137.0 + uHolyShitPhase * 50.0) * (beat * 0.07 + uHolyShitPhase * 0.04);
        float shakeY= cos(st * 97.0  + uHolyShitPhase * 40.0) * (beat * 0.05 + uHolyShitPhase * 0.03);
        return vec3(
            sin(ang + spiral) * d + nudge + shakeX,
            mix(1.6, 6.0, t2) + shakeY + uHolyShitPhase * 0.8,
            cos(ang + spiral) * d
        );
    }
}

float lensVignette(vec2 uv, float beat, float hs) {
    vec2  v    = (uv - 0.5) * 2.0;
    float dist = dot(v, v);
    float vig  = 1.0 - dist * (0.28 + hs * 0.12 + beat * 0.05);
    return clamp(vig, 0.0, 1.0);
}

vec2 lensDistortion(vec2 uv, float strength) {
    vec2 centered = uv - 0.5;
    float r2      = dot(centered, centered);
    float barrel  = 1.0 + r2 * strength;
    return centered * barrel + 0.5;
}

// ================================================================
// SECTION 9: FULL MAIN FUNCTION
// ================================================================

void main() {
    vec2  ndc  = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
    float beat = beatPulse();
    float beatS= beatPulseSharp();
    float bar  = barPulse();
    float hs   = uHolyShitPhase;

    // ---- LENS DISTORTION ----
    float distStrength = 0.08 + hs * 0.12;
    vec2  distUV = lensDistortion(vUV, distStrength * 0.5);
    vec2  ndc2   = (distUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // ---- CAMERA SETUP ----
    vec3 ro     = getCamPos(uProgress, uSceneTime, beat);
    vec3 target = vec3(0.0, 0.8, 0.0);
    vec3 fwd    = normalize(target - ro);
    vec3 right  = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up_    = cross(right, fwd);

    float fovBase = 52.0 + uProgress * 15.0 + hs * 8.0;
    // Dolly zoom: increase FOV at holy-shit while pulling camera back
    float dollyFov= hs * 12.0;
    float fovTan  = tan(radians(fovBase + dollyFov) * 0.5);

    float shake = beat * 0.012 + hs * 0.022;
    vec2  shk   = vec2(
        sin(uTime * 83.0) + sin(uTime * 127.3) * 0.4,
        cos(uTime * 71.0) + cos(uTime * 97.7)  * 0.4
    ) * shake;

    // ---- CHROMATIC ABERRATION ON RAY ----
    float ca  = 0.0018 + hs * 0.008 + beat * 0.003;
    vec3 rdC  = normalize(fwd + (ndc2.x + shk.x) * right * fovTan + (ndc2.y + shk.y) * up_ * fovTan);
    vec3 rdR  = normalize(fwd + (ndc2.x * (1.0 + ca) + shk.x) * right * fovTan + (ndc2.y * (1.0 + ca) + shk.y) * up_ * fovTan);
    vec3 rdB  = normalize(fwd + (ndc2.x * (1.0 - ca) + shk.x) * right * fovTan + (ndc2.y * (1.0 - ca) + shk.y) * up_ * fovTan);
    vec3 rd   = rdC;

    vec3 skyC = skyColor(rd, uProgress);
    vec3 skyR = skyColor(rdR, uProgress);
    vec3 skyB = skyColor(rdB, uProgress);
    vec3 atmos= atmosphericScatter(rd, uProgress);
    skyC += atmos;

    // ---- RAYMARCHING ----
    vec3  hitC = rayMarch(ro, rdC);
    float t    = hitC.x;
    float matID= hitC.y;
    float aoRM = hitC.z;

    // ---- LIGHT POSITIONS ----
    vec3 lKey     = vec3(4.5 * sin(uTime * 0.22), 8.5,  4.5 * cos(uTime * 0.22));
    vec3 lRim     = vec3(-lKey.x * 0.8, lKey.y * 0.4, -lKey.z * 0.8);
    vec3 lFill    = vec3(0.0, -2.0, 8.5);
    vec3 lCorrupt = vec3(sin(uTime * 1.3) * 3.5, -4.0, cos(uTime * 0.9) * 3.5);
    vec3 lGround  = vec3(0.0, -6.8, 0.0);

    vec3 col = skyC;

    if (matID > 0.0 && t < 60.0) {
        vec3  pos = ro + rd * t;
        vec3  N   = calcNormal(pos);
        vec3  V   = -rd;
        float ao  = calcAO(pos, N) * aoRM;

        vec3 L       = normalize(lKey     - pos);
        vec3 Lrim    = normalize(lRim     - pos);
        vec3 Lfil    = normalize(lFill    - pos);
        vec3 Lcorrupt= normalize(lCorrupt - pos);
        vec3 Lgnd    = normalize(lGround  - pos);

        float rim    = pow(max(0.0, 1.0 - dot(N, V)), 2.8);
        float rP     = 1.0 + beat * 2.8;

        float shad   = calcShadow(pos + N * 0.005, L, 0.02, 20.0);

        // ---- MATERIAL 1: MONOLITH ----
        if (matID < 1.5) {
            vec3  alb = vec3(0.018, 0.018, 0.038);
            float ro2 = 0.20;
            float me  = 0.97;

            vec3 shade = cookTorrance(N, V, L,        alb, me, ro2) * vec3(0.6,  0.80, 1.0)  * 4.0  * shad
                       + cookTorrance(N, V, Lrim,     alb, me, ro2) * vec3(0.22, 0.42, 1.0)  * 3.2  * rP
                       + cookTorrance(N, V, Lfil,     alb, me, ro2) * vec3(0.08, 0.14, 0.45) * 1.5
                       + cookTorrance(N, V, Lcorrupt, alb, me, ro2) * vec3(0.50, 0.10, 0.80) * 0.8  * hs
                       + cookTorrance(N, V, Lgnd,     alb, me, ro2) * vec3(0.02, 0.10, 0.35) * 0.4;

            vec3 env = envLighting(N, V, alb, me, ro2,
                mix(vec3(0.035, 0.055, 0.20), vec3(0.10, 0.04, 0.45), hs),
                vec3(0.008, 0.008, 0.030));

            // Multi-layer energy cracks
            float c1 = domainWarpFbm(pos * 2.8  + uTime * 0.09, 4);
            float c2 = fbm3(pos * 7.0  - uTime * 0.07, 3, 2.0, 0.5);
            float c3 = fbm3(pos * 13.0 + uTime * 0.14, 2, 2.0, 0.5);
            float c4 = ridgedFbm(pos * 18.0 + uTime * 0.05, 3);
            float c5 = fbm3(pos * 25.0 - uTime * 0.11, 2, 2.0, 0.5);
            float crk = pow(max(0.0, c1 - 0.40), 2.8) * pow(max(0.0, c2 - 0.32), 2.0)
                      + pow(max(0.0, c3 - 0.50), 3.0) * 0.5
                      + pow(max(0.0, c4 - 0.55), 2.5) * 0.35
                      + pow(max(0.0, c5 - 0.58), 3.5) * 0.2;

            // Circuit engravings
            float engrave = monolithEngraving(pos, uTime);

            float crAmt  = uProgress * (1.0 + beat * 0.6) * (1.0 + hs * 1.8);
            vec3  crHue  = mix(vec3(0.0, 0.65, 1.0), vec3(0.55, 0.12, 1.0), uBarPhase);
            crHue = mix(crHue, vec3(1.0, 0.4, 0.1), hs);

            // Iridescence on surface
            vec3 irid = surfaceIridescence(N, V, uTime);

            vec3 emission = crHue * crk     * crAmt * 4.5
                          + crHue * engrave * crAmt * 2.0
                          + crHue * rim     * rP * uProgress * 1.2
                          + crHue * hs      * 3.5 * (0.4 + rim * 1.8)
                          + irid  * 1.2 * uProgress;

            col = shade + env * ao + emission;

        // ---- MATERIAL 2: ENERGY CORE ----
        } else if (matID < 2.5) {
            vec3 hot  = mix(vec3(0.55, 0.88, 1.0), vec3(1.0, 0.95, 0.65),
                            sin(uTime * 4.0) * 0.5 + 0.5);
            vec3 cool = mix(vec3(0.0, 0.42, 1.0), vec3(0.38, 0.0, 1.0), uBarPhase);
            float pulse = 1.0 + 0.40 * (1.0 - uBeatPhase) * uBeatStrength;
            float glow  = fbm3(pos * 5.5 + uTime * 0.28, 2, 2.0, 0.5);
            float fWave = sin(length(pos.xz) * 8.0 - uTime * 12.0) * 0.5 + 0.5;
            float fWave2= sin(pos.y * 6.0 - uTime * 9.0) * 0.5 + 0.5;

            // Subsurface scattering approximation
            float sss     = pow(max(0.0, dot(-L, N) + 0.5), 2.0) * 0.4;
            float sssBack = pow(max(0.0, dot(L, V)), 1.5) * 0.3;
            vec3  sssCol  = mix(vec3(0.2, 0.6, 1.0), vec3(0.8, 0.2, 1.0), uBarPhase);

            float intensity = 4.5 + beat * 1.8 + hs * 3.0;
            vec3  coreCol   = mix(cool, hot, glow * fWave * fWave2) * intensity * pulse;
            coreCol += sssCol * (sss + sssBack) * intensity * 0.5;

            // Julia set surface detail
            vec2 juliaC = vec2(
                fbm3(pos * 2.0, 2, 2.0, 0.5) * 2.0 - 1.0,
                fbm3(pos * 2.0 + 3.7, 2, 2.0, 0.5) * 2.0 - 1.0
            ) * 0.3;
            vec2 juliaSeed = vec2(-0.4, 0.6) + juliaC;
            vec2 juliaRes  = juliaSet2D(pos.xy * 0.5, juliaSeed);
            vec3 juliaGlow = mix(cool, hot, juliaRes.x) * 1.5 * uProgress;

            col = coreCol + juliaGlow;

        // ---- MATERIAL 3: GROUND ----
        } else if (matID < 3.5) {
            vec3  alb   = vec3(0.025, 0.025, 0.048);
            float met   = 0.82;
            float roug  = 0.30;
            vec3  shade = cookTorrance(N, V, L,        alb, met, roug) * vec3(0.5,  0.72, 1.0)  * 3.2 * shad
                        + cookTorrance(N, V, Lrim,     alb, met, roug) * vec3(0.22, 0.42, 1.0)  * 1.8
                        + cookTorrance(N, V, Lgnd,     alb, met, roug) * vec3(0.02, 0.08, 0.30) * 0.6
                        + cookTorrance(N, V, Lcorrupt, alb, met, roug) * vec3(0.40, 0.08, 0.60) * 0.5 * hs;
            vec3  env   = envLighting(N, V, alb, met, roug, vec3(0.018, 0.038, 0.14), vec3(0.006));
            float hexG  = hexGrid(pos.xz * 0.42 + 0.5, 11.0);
            float shock = shockwaveRing(pos, uBeatPhase, uBeatStrength);
            float caustic= causticsPattern(pos, uTime);
            vec2  vorRes = voronoi2(pos.xz * 0.85 + vec2(0.3, 0.7));
            float crackGlow = (1.0 - smoothstep(0.0, 0.05, vorRes.x)) * uProgress;
            vec3  sHue  = mix(vec3(0.0, 0.5, 1.0), vec3(0.5, 0.0, 1.0), uBarPhase);
            col = shade + env * ao
                + vec3(0.0, 0.55, 1.0) * hexG * (0.5 + beat * 0.7) * uProgress
                + sHue  * shock    * 2.5
                + sHue  * hs       * hexG * 1.8
                + sHue  * crackGlow * 1.5
                + vec3(0.3, 0.8, 1.0) * caustic * 1.2;

        // ---- MATERIAL 4: DEBRIS ----
        } else if (matID < 4.5) {
            float dH  = hash12(pos.xy + pos.z * 0.37);
            vec3  dCol= debrisGlow(pos, dH, uTime);
            float alb2= dH * 0.3;
            vec3  albD= vec3(alb2, alb2, alb2 * 1.5);
            vec3  shade = cookTorrance(N, V, L,    albD, 0.7, 0.4) * vec3(0.5, 0.7, 1.0) * 2.5 * shad
                        + cookTorrance(N, V, Lrim, albD, 0.7, 0.4) * vec3(0.2, 0.4, 1.0) * 1.5;
            vec3  env   = envLighting(N, V, albD, 0.7, 0.4, vec3(0.02, 0.04, 0.15), vec3(0.005));
            vec3  irid  = surfaceIridescence(N, V, uTime + dH * 5.0);
            col = shade + env * ao
                + dCol * (3.2 + beat * dH * 2.0 + hs * 2.5)
                + dCol * rim * 2.5
                + irid  * 0.8;

        // ---- MATERIAL 5: TENTACLES ----
        } else if (matID < 5.5) {
            float tH   = hash13(floor(pos * 6.0));
            int   tIdx = int(tH * 14.0);
            vec3  tc   = tentacleGlow(pos, uTime, tIdx);
            float tG   = fbm3(pos * 4.0 + uTime * 0.2, 2, 2.0, 0.5);
            float tV   = crystalVein(pos, uTime);
            vec3  albT = tc * 0.08;
            vec3  shade= cookTorrance(N, V, L, albT, 0.6, 0.35) * vec3(0.4, 0.6, 1.0) * 2.0 * shad;
            col = shade
                + tc * (4.2 + beat * 1.5 + hs * 3.5) * (0.6 + tG * 0.7)
                + tc * tV * 2.5
                + tc * rim * 1.8;

        // ---- MATERIAL 6: CRYSTAL SPIRES ----
        } else if (matID < 6.5) {
            float cH  = hash13(floor(pos * 3.0));
            int   cIdx= int(cH * 8.0);
            vec3  cCol= crystalSpireColor(pos, uTime, cIdx);
            vec3  albS= cCol * 0.05;
            float met2= 0.3;
            float roug2= 0.15;
            vec3  shade = cookTorrance(N, V, L,    albS, met2, roug2) * vec3(0.6, 0.8, 1.0) * 3.5 * shad
                        + cookTorrance(N, V, Lrim, albS, met2, roug2) * vec3(0.3, 0.5, 1.0) * 2.0
                        + cookTorrance(N, V, Lfil, albS, met2, roug2) * vec3(0.1, 0.2, 0.5) * 0.8;
            vec3  env   = envLighting(N, V, albS, met2, roug2, vec3(0.02, 0.05, 0.20), vec3(0.005));
            vec3  irid  = surfaceIridescence(N, V, uTime + cH * 3.0);
            float vein  = crystalVein(pos, uTime);
            col = shade + env * ao
                + cCol * (2.5 + beat * 1.2 + hs * 2.0) * smoothstep(0.4, 1.0, uProgress)
                + cCol * vein * 3.0
                + irid  * 1.5
                + cCol * rim * 2.0;

        // ---- MATERIAL 7: ENERGY RINGS ----
        } else if (matID < 7.5) {
            float rH  = hash13(floor(pos * 4.0));
            int   rIdx= int(rH * 4.0);
            vec3  rCol= energyRingColor(pos, uTime, rIdx);
            vec3  albR= rCol * 0.03;
            vec3  shade= cookTorrance(N, V, L,    albR, 0.9, 0.10) * vec3(0.5, 0.7, 1.0) * 4.0 * shad
                       + cookTorrance(N, V, Lrim, albR, 0.9, 0.10) * vec3(0.3, 0.5, 1.0) * 2.5;
            float ringGlow = pow(1.0 - abs(dot(N, V)), 3.0);
            col = shade
                + rCol * (3.0 + beat * 2.0 + hs * 3.0)
                + rCol * ringGlow * 4.0
                + rCol * rim * 3.0;

        // ---- MATERIAL 8: FRACTAL DUST ----
        } else {
            float dH2 = hash13(floor(pos * 12.0));
            vec3  dustCol = hsvToRgb(vec3(fract(dH2 * 1.618 + uBarPhase * 0.2), 0.9, 1.0));
            col = dustCol * (1.5 + beat * 0.8) * uProgress * 0.7;
        }

        // ---- PER-HIT FOG ----
        float fogDist = 1.0 - exp(-t * 0.010);
        vec3  fogColor= mix(skyC, skyC * 0.3, uProgress * 0.5);
        col = mix(col, fogColor, fogDist * 0.6);
    }

    // ---- VOLUMETRIC FOG ----
    vec3 volFog = volumetricFog(ro, rd, min(t, 60.0), uTime);
    col += volFog * uProgress * 1.8;

    // ---- GOD RAYS (3 light sources) ----
    vec3 rays1 = godRays(ro, rd, vec3(0.0, -1.8, 0.0), beat);
    vec3 rays2 = godRays(ro, rd, vec3(0.0,  6.8, 0.0), beat * 0.45)
               * smoothstep(0.32, 0.70, uProgress);
    vec3 rays3 = godRays(ro, rd, lKey, beat * 0.30)
               * smoothstep(0.50, 0.85, uProgress);
    col += rays1 * uProgress * 3.0
         + rays2 * 1.8
         + rays3 * 1.2;

    // ---- ENERGY WAVES ----
    vec3  wSample = ro + rd * (t * 0.5);
    float waves   = energyWaves(wSample, uBeatPhase, uBeatStrength);
    vec3  wHue    = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.15, 1.0), uBarPhase * 0.7);
    wHue = mix(wHue, vec3(1.0, 0.4, 0.0), hs * 0.6);
    col += wHue * waves * 4.5;

    // ---- BPM FLASHES (4 harmonics) ----
    float barFlash   = pow(max(0.0, 1.0 - uBarPhase  * 7.0), 3.0) * 0.45
                     * smoothstep(0.22, 0.48, uProgress);
    float beatFlash  = pow(max(0.0, 1.0 - uBeatPhase * 5.0), 4.0) * 0.22 * uBeatStrength;
    float beatFlash2 = pow(max(0.0, 1.0 - uBeatPhase * 9.0), 5.0) * 0.12 * uBeatStrength;
    float beatFlash3 = pow(max(0.0, 1.0 - uBeatPhase * 13.0), 6.0) * 0.06 * uBeatStrength;
    float beatFlash4 = pow(max(0.0, 1.0 - uBeatPhase * 18.0), 7.0) * 0.03 * uBeatStrength;
    vec3  flashHue   = mix(vec3(0.25, 0.55, 1.0), vec3(0.5, 0.1, 1.0), uBarPhase);
    flashHue = mix(flashHue, vec3(1.0, 0.3, 0.1), hs * 0.5);
    col += flashHue * (barFlash + beatFlash + beatFlash2 + beatFlash3 + beatFlash4);

    // ---- HOLY-SHIT SCREEN EFFECTS ----
    if (hs > 0.01) {
        // Radial energy burst
        float radDist = length(vUV - 0.5);
        vec3  burstCol= mix(vec3(0.1, 0.4, 1.0), vec3(1.0, 0.3, 0.0), hs);
        col += burstCol * exp(-radDist * (3.5 - hs * 2.0)) * hs * 4.5;

        // Full-screen warp (screen-space UV distortion)
        float warpStrength = hs * 0.04;
        float warpNoise1   = sin(vUV.x * 20.0 + uTime * 8.0) * warpStrength;
        float warpNoise2   = cos(vUV.y * 18.0 - uTime * 7.0) * warpStrength;
        vec2  warpedUV     = vUV + vec2(warpNoise1, warpNoise2);
        warpedUV = clamp(warpedUV, 0.0, 1.0);
        float warpBlend    = hs * 0.25;
        col = mix(col, col * (1.0 + vec3(
            sin(warpedUV.x * 8.0 + uTime * 3.0),
            sin(warpedUV.y * 7.0 + uTime * 2.5),
            cos(warpedUV.x * 9.0 - uTime * 4.0)
        ) * 0.3), warpBlend);

        // Color shift / hue rotation
        float hueShift = hs * 0.18;
        vec3  hsvCol   = col;
        float hue2     = atan(hsvCol.b - hsvCol.g, hsvCol.r) / (2.0 * PI) + hueShift;
        col = mix(col, hsvToRgb(vec3(fract(hue2), 1.0, length(col))), hs * 0.3);

        // Particle burst effect (screen-space procedural)
        float pBurst = 0.0;
        for (int pi = 0; pi < 8; pi++) {
            float pfi   = float(pi);
            float pAng  = pfi * (2.0 * PI / 8.0) + uTime * (1.0 + pfi * 0.3);
            float pRad  = hs * (0.2 + pfi * 0.04) * (0.5 + sin(uTime * 5.0 + pfi) * 0.3);
            vec2  pPos  = vec2(0.5) + vec2(sin(pAng), cos(pAng)) * pRad;
            float pDist = length(vUV - pPos);
            pBurst += exp(-pDist * 40.0) * (1.0 - pDist * 3.0);
        }
        col += burstCol * max(0.0, pBurst) * hs * 3.0;

        // Scan lines at climax
        float scanLine = sin(vUV.y * uResolution.y * 0.5) * 0.5 + 0.5;
        col = mix(col, col * scanLine, hs * 0.15);
    }

    // ---- CHROMATIC ABERRATION (post) ----
    {
        float caPost = 0.003 + hs * 0.008 + beat * 0.002;
        vec2  caDir  = normalize(vUV - 0.5 + 0.001);
        float rOff   = caPost * length(vUV - 0.5);
        // Blend with slight lateral color shift
        col.r = col.r * (1.0 + sin(vUV.y * 120.0 + uTime * 6.0) * caPost * 0.5);
        col.b = col.b * (1.0 + cos(vUV.x * 110.0 + uTime * 5.0) * caPost * 0.5);
        col.r = mix(col.r, col.r + caDir.x * rOff * 0.5, hs * 0.4 + 0.1);
        col.b = mix(col.b, col.b - caDir.x * rOff * 0.5, hs * 0.4 + 0.1);
    }

    // ---- VIGNETTE WITH BEAT PULSE ----
    float vig = lensVignette(vUV, beat, hs);
    col *= vig;

    // ---- FADE IN ----
    col *= smoothstep(0.0, 0.10, uProgress);

    // ---- ACES FILMIC TONE MAPPING ----
    {
        const float a = 2.51;
        const float b = 0.03;
        const float c2 = 2.43;
        const float d = 0.59;
        const float e2 = 0.14;
        col = clamp((col * (a * col + b)) / (col * (c2 * col + d) + e2), 0.0, 1.0);
    }

    // ---- GAMMA CORRECTION ----
    col = pow(col, vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
