#version 460 core
// SCENE 3: NEON-STRASSE — Cyberpunk Boden-Shader
// Nasse Asphalt-Spiegelungen mit CP2077-Farbbluten,
// Holo-Projektion auf Boden, BPM-Shockwaves, Lichtlecks

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;

out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform vec3  uCameraPos;

// ============================================================
// WASSER-NORMALEN
// ============================================================
vec3 waterNormal(vec2 p, float t) {
    const float e = 0.015;
    vec2 p1 = p * 3.8 + vec2( t * 0.12,  t * 0.09);
    vec2 p2 = p * 7.0 + vec2(-t * 0.07,  t * 0.15);
    vec2 p3 = p * 14.0+ vec2( t * 0.22, -t * 0.11);
    float dx = (fbm2(p1+vec2(e,0),3,2.0,0.5)-fbm2(p1-vec2(e,0),3,2.0,0.5))*0.5
             + (fbm2(p2+vec2(e,0),2,2.0,0.5)-fbm2(p2-vec2(e,0),2,2.0,0.5))*0.28;
    float dz = (fbm2(p1+vec2(0,e),3,2.0,0.5)-fbm2(p1-vec2(0,e),3,2.0,0.5))*0.5
             + (fbm2(p2+vec2(0,e),2,2.0,0.5)-fbm2(p2-vec2(0,e),2,2.0,0.5))*0.28;
    return normalize(vec3(-dx, 1.0, -dz));
}

vec3 waterNormal2(vec2 p, float t) {
    const float e = 0.010;
    vec2 p1 = p * 2.9 + vec2( t * 0.10,  t * 0.07);
    vec2 p2 = p * 5.5 + vec2(-t * 0.09,  t * 0.14);
    vec2 p3 = p * 11.0+ vec2( t * 0.20, -t * 0.10);
    vec2 p4 = p * 20.0+ vec2(-t * 0.32,  t * 0.25);
    float dx = (fbm2(p1+vec2(e,0),4,2.0,0.5)-fbm2(p1-vec2(e,0),4,2.0,0.5))*0.42
             + (fbm2(p2+vec2(e,0),3,2.0,0.5)-fbm2(p2-vec2(e,0),3,2.0,0.5))*0.28
             + (fbm2(p3+vec2(e,0),2,2.0,0.5)-fbm2(p3-vec2(e,0),2,2.0,0.5))*0.16
             + (vnoise2(p4+vec2(e,0))-vnoise2(p4-vec2(e,0)))*0.14;
    float dz = (fbm2(p1+vec2(0,e),4,2.0,0.5)-fbm2(p1-vec2(0,e),4,2.0,0.5))*0.42
             + (fbm2(p2+vec2(0,e),3,2.0,0.5)-fbm2(p2-vec2(0,e),3,2.0,0.5))*0.28
             + (fbm2(p3+vec2(0,e),2,2.0,0.5)-fbm2(p3-vec2(0,e),2,2.0,0.5))*0.16
             + (vnoise2(p4+vec2(0,e))-vnoise2(p4-vec2(0,e)))*0.14;
    return normalize(vec3(-dx * 1.5, 1.0, -dz * 1.5));
}

vec3 rainImpact(vec2 p, float t) {
    vec3 N = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < 18; i++) {
        float fi  = float(i);
        vec2  pos = (vec2(hash12(vec2(fi*0.38,fi*0.84)), hash12(vec2(fi*1.22,fi*0.48)))*2.0-1.0)*8.0;
        float ph  = fract(t * 0.38 + hash11(fi * 0.19));
        float str = (1.0 - ph) * 0.55;
        vec2 d    = p - pos;
        float r   = length(d);
        float wave= sin(r * 15.0 - ph * 2.6 * 6.28318) * exp(-r * 3.8) * exp(-ph * 1.2) * str;
        vec2 grad = (r > 0.001) ? normalize(d) * wave * 0.8 : vec2(0.0);
        N += vec3(-grad.x, 0.0, -grad.y) * 0.11;
    }
    return normalize(N);
}

// ============================================================
// PFÜTZEN
// ============================================================
float puddleMask(vec2 p) {
    return smoothstep(0.35, 0.18, voronoi2(p * 0.5).x);
}

float puddleDepth(vec2 p) {
    float d1 = smoothstep(0.28, 0.10, voronoi2(p * 0.04).x);
    float d2 = smoothstep(0.18, 0.05, voronoi2(p * 0.09 + 3.7).x);
    return max(d1 * 0.3, d2) * (0.5 + fbm2(p * 0.06, 3, 2.0, 0.5) * 0.5);
}

float puddleCaustics(vec2 p, float t) {
    float c1 = abs(sin(fbm2(p * 3.8 + vec2( t*0.42,  t*0.28), 3, 2.0, 0.5) * 6.28318));
    float c2 = abs(sin(fbm2(p * 5.2 + vec2(-t*0.33,  t*0.19), 3, 2.0, 0.5) * 6.28318 + 1.047));
    float c3 = abs(sin(fbm2(p * 2.2 + vec2(-t*0.24,  t*0.43), 2, 2.0, 0.5) * 6.28318 + 2.094));
    return pow(min(min(c1, c2), c3), 0.38) * 0.5 * puddleMask(p * 0.04) * 1.8;
}

// ============================================================
// ASPHALT
// ============================================================
float asphaltTexture(vec2 p, float seed) {
    float c = fbm2(p * 1.2, 3, 2.0, 0.55);
    float f = vnoise2(p * 8.0 + seed) * 0.3;
    return c * 0.6 + f * 0.4;
}

float asphaltCrack(vec2 p, float seed) {
    vec2 q = p * 0.7 + seed * 3.7;
    float f1 = fbm2(q,            5, 2.1, 0.58);
    float f2 = fbm2(q * 2.3 + 5.1, 3, 2.0, 0.50);
    float c1 = 1.0 - smoothstep(0.0, 0.04, abs(f1 - 0.5));
    float c2 = 1.0 - smoothstep(0.0, 0.025, abs(f2 - 0.48));
    return max(c1 * 0.7, c2 * 0.5);
}

// ============================================================
// STRASSEN-MARKIERUNGEN
// ============================================================
float roadMarkings(vec2 p) {
    float lw = 0.12, dl = 4.0, dg = 3.0, per = 7.0;
    float lx = smoothstep(lw, lw*0.5, abs(p.y)) * step(fract(p.x/per), dl/per);
    float lz = smoothstep(lw, lw*0.5, abs(p.x)) * step(fract(p.y/per), dl/per);
    float cx = step(6.0, abs(p.x)) * step(abs(p.x), 7.5)
             * smoothstep(0.4, 0.3, abs(fract(p.y * 0.8) - 0.5));
    float cz = step(6.0, abs(p.y)) * step(abs(p.y), 7.5)
             * smoothstep(0.4, 0.3, abs(fract(p.x * 0.8) - 0.5));
    return max(max(lx, lz), max(cx, cz));
}

float tramRails(vec2 p) {
    float hw = 0.75, rw = 0.06;
    float l = smoothstep(rw, rw*0.3, abs(p.x - (-hw)));
    float r = smoothstep(rw, rw*0.3, abs(p.x -   hw));
    float c = sin(p.y * 0.05) * 1.5;
    float lc = smoothstep(rw, rw*0.3, abs(p.x - c - (-hw)));
    float rc = smoothstep(rw, rw*0.3, abs(p.x - c -   hw));
    return max(max(l, r), max(lc, rc)) * 0.9;
}

float manholeRing(vec2 p) {
    float res = 0.0;
    vec2 mp[2];
    mp[0] = vec2(3.5, 5.0); mp[1] = vec2(-4.0, -3.5);
    for (int i = 0; i < 2; i++) {
        vec2 lp = p - mp[i];
        float outer = smoothstep(0.04, 0.0, abs(length(lp) - 0.70));
        float inner = smoothstep(0.04, 0.0, abs(length(lp) - 0.55));
        float sp = 0.0;
        for (int s = 0; s < 8; s++) {
            float a = float(s) * 3.14159 / 4.0;
            vec2 d  = vec2(cos(a), sin(a));
            float pj = dot(lp, d);
            float pe = length(lp - d * clamp(pj, 0.0, 0.62));
            sp = max(sp, smoothstep(0.04, 0.0, pe));
        }
        res = max(res, max(outer, max(inner, sp)));
    }
    return res;
}

// ============================================================
// CP2077 REFLEXIONEN — Neon-Farb-Bluten in Pfützen
// ============================================================
vec3 neonPuddleReflection(vec3 N, vec3 V, vec2 p, float t, float barPhase, float corrupt) {
    vec3 R = reflect(-V, N);

    // Nacht-Himmel: tiefes Indigo
    float hR  = R.y * 0.5 + 0.5;
    vec3 sky  = mix(vec3(0.07, 0.025, 0.16), vec3(0.003, 0.002, 0.020), pow(hR, 0.4));

    // CP2077 Neon-Reflexe: Cyan, Magenta, Orange, Violett
    float nr1 = hash12(R.xz * 2.8 + vec2(1.7, t * 0.09));
    float nr2 = hash12(R.xz * 4.1 + vec2(t * 0.08, 3.2));
    float nr3 = hash12(R.xz * 3.5 + vec2(2.4, t * 0.12));
    float nr4 = hash12(R.xz * 5.2 + vec2(t * 0.06, 1.9));
    sky += vec3(0.0,  0.92, 1.0)  * step(0.85, nr1) * 0.65;  // Cyan
    sky += vec3(1.0,  0.04, 0.42) * step(0.87, nr2) * 0.55;  // Magenta
    sky += vec3(1.0,  0.44, 0.0)  * step(0.89, nr3) * 0.45;  // Orange
    sky += vec3(0.75, 0.0,  1.0)  * step(0.91, nr4) * 0.40;  // Violett

    // Korruptions-Grün/Lila
    sky += mix(vec3(0.0, 0.85, 0.3), vec3(0.7, 0.0, 1.0), barPhase)
         * corrupt * step(0.82, hash12(R.xz * 3.6 + t * 0.04)) * 0.75;

    // Gebäude-Silhouetten im Spiegel
    for (int b = 0; b < 4; b++) {
        float fb = float(b);
        float bx = hash11(fb * 0.38) * 28.0 - 14.0;
        float bw = hash11(fb * 0.72) * 2.2 + 0.8;
        float bh = hash11(fb * 1.15) * 7.0 + 2.5;
        float bo = p.x - bx;
        float si = step(abs(bo), bw) * step(0.0, p.y + bh);
        float wr = fract((p.y + bh) * 1.4) * fract(bo * 2.2);
        float wl = step(0.84, hash12(vec2(floor(bo*2.2)*0.3+fb, floor((p.y+bh)*1.4)*0.18+t*0.02)));
        sky = max(sky, vec3(si * (0.15 + wl * wr * 0.85) * 0.4));
    }

    // Straßenlaternen-Reflex
    float lamp = exp(-abs(R.y - 0.12) * 14.0) * 0.35;
    sky += vec3(0.9, 0.76, 0.46) * lamp;

    return sky;
}

// ============================================================
// HOLO-PROJEKTION auf Boden (kreisförmige Hologramme)
// ============================================================
vec3 holoProjection(vec2 p, float t, float corrupt) {
    vec3 result = vec3(0.0);

    for (int i = 0; i < 5; i++) {
        float fi  = float(i);
        vec2  cp  = vec2(hash11(fi * 0.37 + 3.1), hash11(fi * 0.71 + 1.4)) * 24.0 - 12.0;
        float r   = length(p - cp);
        float ang = atan(p.y - cp.y, p.x - cp.x);

        // Rotierende Ring-Muster
        float rot  = t * (0.3 + hash11(fi) * 0.4);
        float ring1 = smoothstep(0.03, 0.0, abs(r - 2.5));
        float ring2 = smoothstep(0.02, 0.0, abs(r - 1.8));
        float ring3 = smoothstep(0.015,0.0, abs(r - 1.1));

        // Segmentierte Ringe (Lücken)
        float seg = step(0.5, sin(ang * 8.0 + rot));

        // Farbe pro Projektor
        float cs = hash11(fi * 1.21 + 5.3);
        vec3 hc = (cs < 0.33) ? vec3(0.0, 0.9, 1.0)
                : (cs < 0.66) ? vec3(1.0, 0.04, 0.44)
                               : vec3(0.8, 0.0, 1.0);

        float brightness = (ring1 * 1.5 + ring2 + ring3 * 0.6) * seg
                         * exp(-r * 0.25) * (0.4 + corrupt * 0.6);
        result += hc * brightness * 1.8;
    }
    return result;
}

// ============================================================
// VOID-RISS (Boden-Korruptions-Leck)
// ============================================================
float voidCrack(vec2 p, float corrupt, float t) {
    float c1 = asphaltCrack(p * 0.08, 9.1) * pow(corrupt, 1.5);
    float d  = smoothstep(0.1, 0.6, c1);
    float fl = sin(t * 7.3 + p.x * 2.1) * sin(t * 4.9 - p.y * 1.7);
    return d * exp(-length(p) * 0.04) * (0.5 + 0.5 * fl) * corrupt;
}

// ============================================================
// DATA-LECK (digitale Daten-Ströme aus Rissen)
// ============================================================
vec3 dataLeak(vec2 p, float corrupt, float t) {
    float cracks = asphaltCrack(p * 0.25, 4.4);
    float scan   = step(0.5, fract(p.y * 2.0 - t * 1.8));
    float glyph  = step(0.58, hash12(floor(p * 1.6) * 0.14 + floor(t * 8.0) * 0.07));
    float data   = cracks * scan * glyph;
    float wh     = hash11(floor(p.x*1.5)*0.44 + floor(p.y*1.5)*0.72);
    vec3 dc = (wh < 0.33) ? vec3(0.0, 1.0, 0.38)
            : (wh < 0.66) ? vec3(0.0, 0.6, 1.0)
                           : vec3(1.0, 0.0, 0.52);
    return dc * data * pow(corrupt, 0.8) * (1.5 + exp(-length(p) * 0.05) * corrupt);
}

// ============================================================
// KORRUPTIONS-HEX-GRID
// ============================================================
float hexCorrupt(vec2 p, float corrupt, float t) {
    float e1 = smoothstep(0.12, 0.02, voronoi2(p * 0.08).x);
    float e2 = smoothstep(0.08, 0.01, voronoi2(p * 0.20 + 7.3).x);
    float pu = (1.0 + sin(t * 3.0 - length(p) * 0.28) * 0.5) * 0.5;
    return (e1 * 0.7 + e2 * 0.3) * pow(corrupt, 1.2) * pu;
}

// ============================================================
// SHOCKWAVE
// ============================================================
float groundShockwave(vec2 p, float phase, float strength) {
    float r = length(p);
    float radius = phase * 20.0;
    float w = 0.5 + phase * 1.2;
    return exp(-abs(r - radius) / w) * (1.0 - phase) * strength;
}

// ============================================================
// ÖLTÜMPEL (Iridescent)
// ============================================================
vec3 oilSlick(vec2 p, float t) {
    vec2  q  = p * 0.12 + vec2(t * 0.005, t * 0.003);
    float mk = smoothstep(0.65, 0.40, voronoi2(q).x) * 0.7;
    float n1 = fbm2(p * 0.4 + t * 0.02, 3, 2.0, 0.5);
    float n2 = fbm2(p * 1.2 - t * 0.03, 2, 2.0, 0.5);
    float ph = n1 * 6.28318 + n2 * 3.14159 + t * 0.4;
    vec3 c1 = vec3(1.0, 0.0, 0.5); vec3 c2 = vec3(0.0, 0.8, 1.0);
    vec3 c3 = vec3(0.9, 0.7, 0.0); vec3 c4 = vec3(0.3, 0.0, 0.9);
    vec3 tf = mix(mix(c1,c2, sin(ph)*0.5+0.5), mix(c3,c4, sin(ph+2.094)*0.5+0.5),
                  sin(ph+4.189)*0.5+0.5);
    return tf * mk;
}

// ============================================================
// MAIN
// ============================================================
void main() {
    vec2  p   = vWorldPos.xz;
    vec3  N   = vec3(0.0, 1.0, 0.0);
    vec3  V   = normalize(uCameraPos - vWorldPos);
    float cor = uProgress;

    float beat = pow(max(0.0, 1.0 - uBeatPhase * 2.0), 2.0) * uBeatStrength;
    float barP = pow(max(0.0, 1.0 - uBarPhase  * 5.0), 3.0) * uBeatStrength;

    // ─── REGEN-INTENSITÄT ─────────────────────────────────────────────────────
    float rain = clamp((0.6 + 0.4 * sin(uTime * 0.11))
                     * fbm2(p * 0.02 + uTime * 0.007, 2, 2.0, 0.5) * 1.5, 0.25, 1.0);

    // ─── ASPHALT BASIS ────────────────────────────────────────────────────────
    float asp    = asphaltTexture(p * 0.08, 1.7);
    float cracks = asphaltCrack(p * 0.10, 3.1);
    vec3 aCol    = mix(vec3(0.042, 0.042, 0.050),
                       vec3(0.022, 0.022, 0.028), asp);
    aCol         = mix(aCol, vec3(0.014, 0.014, 0.016), cracks * 0.55);

    // Öl-Schleier
    vec3 oil  = oilSlick(p * 0.2, uTime);
    float omk = smoothstep(0.55, 0.70, fbm2(p * 0.07 + 2.1, 2, 2.0, 0.5)) * 0.38;
    aCol     += oil * omk;

    // ─── STRASSEN-MARKIERUNGEN ────────────────────────────────────────────────
    float marks = roadMarkings(p * 0.5);
    float rails = tramRails(p);
    float manhole = manholeRing(p);

    // Korrupte Markierungen
    float noiseOff = fbm2(p * 0.4 + uTime * 0.3, 3, 2.0, 0.5);
    vec2  warpP    = p + (vec2(noiseOff - 0.5, hash12(p * 0.1 + uTime * 0.1) - 0.5)) * cor * 3.5;
    float wmarks   = roadMarkings(warpP * 0.5);
    float glitch   = step(0.87, hash12(p * 0.2 + floor(uTime * 12.0) * 0.1));
    marks = mix(marks * (1.0 - cor * glitch * 0.9), max(marks, wmarks * cor), cor);

    aCol = mix(aCol, vec3(0.60, 0.56, 0.46), marks * 0.65);
    aCol = mix(aCol, vec3(0.32, 0.30, 0.28), rails * 0.45);
    aCol = mix(aCol, vec3(0.17, 0.16, 0.15), manhole * 0.55);

    // ─── PFÜTZEN + WASSER-NORMAL ──────────────────────────────────────────────
    float puddle  = puddleMask(p * 0.04);
    float depth   = puddleDepth(p);
    float caustic = puddleCaustics(p, uTime);

    vec3 wN1    = waterNormal(p * 0.04, uTime);
    vec3 wN2    = waterNormal2(p * 0.035, uTime);
    vec3 rainN  = rainImpact(p * 0.1, uTime);
    vec3 waterN = normalize(mix(wN1, mix(wN2, rainN, rain * 0.5), 0.4));
    N           = mix(N, waterN, puddle * 0.88);

    // Wind-Verwirbelung der Reflexion
    float windy  = 0.38 + 0.28 * sin(uTime * 0.17);
    vec2  windUV = p * 0.15 + vec2(0.7, 0.3) * uTime * 0.55 * windy;
    float warp   = fbm2(windUV, 3, 2.0, 0.5) * windy * 0.38;
    vec3  Ndist  = normalize(N + vec3(warp * 0.12, 0.0, warp * 0.08));

    // ─── FRESNEL + SPIEGELUNG ─────────────────────────────────────────────────
    float wet    = mix(0.55, 1.0, puddle);
    float ct     = max(dot(Ndist, V), 0.0);
    float fresnel = (0.04 + 0.96 * pow(1.0 - ct, 5.0)) * wet;

    vec3 refl = neonPuddleReflection(Ndist, V, p, uTime, uBarPhase, cor);
    aCol += vec3(0.04, 0.08, 0.06) * caustic * puddle;
    aCol *= mix(1.0, 0.58, wet * 0.60);

    // ─── MATERIAL ─────────────────────────────────────────────────────────────
    float metal = mix(0.0, 0.88, rails * 0.5);
    float rough = mix(0.90, 0.04, wet * (puddle * 0.72 + 0.28));
    rough = mix(rough, 0.22, rails * 0.5);
    rough = mix(rough, 0.14, manhole * 0.45);

    // ─── BELEUCHTUNG ──────────────────────────────────────────────────────────
    vec3 moonDir  = normalize(vec3(0.30, 0.76, 0.40));
    vec3 moonCol  = vec3(0.38, 0.50, 0.84) * 2.0;
    vec3 lamp1Dir = normalize(vec3(-0.5, 0.82, 0.30));
    vec3 lamp1Col = vec3(0.92, 0.76, 0.46) * 0.75;   // warme Straßenlaterne
    vec3 lamp2Dir = normalize(vec3(0.6, 0.72, -0.4));
    vec3 lamp2Col = vec3(0.88, 0.72, 0.40) * 0.55;
    vec3 neonDir  = normalize(vec3(-0.3, 0.65, 0.7));
    // Neon-Licht von Gebäuden: wechselt Cyan/Magenta mit BarPhase
    vec3 neonSignCol = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.04, 0.44), uBarPhase)
                     * (0.6 + cor * 0.8);

    vec3 shading = cookTorrance(N, V, moonDir,  aCol, metal, rough) * moonCol
                 + cookTorrance(N, V, lamp1Dir, aCol, metal, rough) * lamp1Col
                 + cookTorrance(N, V, lamp2Dir, aCol, metal, rough) * lamp2Col
                 + cookTorrance(N, V, neonDir,  aCol, metal, rough) * neonSignCol;

    // Ambiente Stadtlicht
    vec3 amb = mix(vec3(0.032, 0.014, 0.008), vec3(0.012, 0.048, 0.010), cor);
    shading += aCol * amb;

    // Fresnel-Reflektion
    shading = mix(shading, refl, fresnel);

    // ─── HOLO-PROJEKTION AUF BODEN ────────────────────────────────────────────
    vec3 holo = holoProjection(p, uTime, cor);
    shading += holo * (puddle * 0.4 + 0.15);

    // ─── VOID-RISSE + DATA-LECK ───────────────────────────────────────────────
    float voidC = voidCrack(p, cor, uTime);
    vec3  crCol = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.0, 0.5), uBarPhase);
    shading    += crCol * voidC * 2.8;
    shading    += dataLeak(p, cor, uTime) * 1.9;

    // ─── KORRUPTIONS-HEX-GRID ────────────────────────────────────────────────
    float hx  = hexCorrupt(p, cor, uTime);
    vec3  hxC = mix(vec3(0.0, 1.0, 0.28), vec3(0.72, 0.0, 1.0), uBarPhase);
    shading  += hxC * hx * (1.6 + beat * 1.8);

    // ─── CP2077 SHOCKWAVES (mehrere Ringe) ────────────────────────────────────
    float sh1 = groundShockwave(p,                   uBeatPhase,              uBeatStrength);
    float sh2 = groundShockwave(p, fract(uBeatPhase + 0.33), uBeatStrength * 0.62);
    float sh3 = groundShockwave(p, fract(uBeatPhase + 0.66), uBeatStrength * 0.38);
    vec3  shC = mix(vec3(0.0, 0.5, 1.0), vec3(0.5, 0.0, 1.0), uBarPhase);
    shading  += shC * (sh1 * 2.4 + sh2 * 1.4 + sh3 * 0.8);

    // Bar-Blitz
    shading += mix(vec3(0.05, 0.02, 0.22), vec3(0.02, 0.16, 0.05), cor) * barP * 0.65;

    // ─── DISTANZ-NEBEL ────────────────────────────────────────────────────────
    float dist = length(uCameraPos - vWorldPos);
    float ff   = 1.0 - exp(-dist * 0.0070);
    vec3  fc   = mix(vec3(0.008, 0.008, 0.025), vec3(0.014, 0.042, 0.010), cor);
    shading    = mix(shading, fc, ff);

    fragColor = vec4(shading, 1.0);
}
