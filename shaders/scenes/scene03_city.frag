#version 460 core
// SCENE 3: NIGHT CITY — Cyberpunk Metropolis
// Inspiriert von Cyberpunk 2077, Blade Runner 2049, Ghost in the Shell
// Techniken: Holo-Billboards, Neon-Edge-Tubes, Megastruktur-LED-Strips,
//            Regen-Fassaden, Dach-Logos, Flug-Fahrzeug-Lichter,
//            Volumenebel (Magenta/Cyan), Kristall-Korruption

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in vec3  vWorldPos;
in vec3  vNormal;
in vec2  vUV;
in float vCorruption;
in float vSeed;
in float vHeight;
in float vBuildingType;
in float vNormalizedY;

out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform float uHolyShitPhase;
uniform vec3  uCameraPos;
uniform vec2  uResolution;

// ============================================================
// HOLO-BILLBOARD — animierte CP2077-Werbeanzeige
// ============================================================
vec3 holoBillboard(vec2 uv, float seed, float t, float corrupt, float beat) {
    // Marken-Palette: 4 Firmen-Stile
    float pi = hash11(seed * 3.7);
    vec3 bp, bs;
    if      (pi < 0.25) { bp = vec3(0.0,  0.94, 1.0);  bs = vec3(1.0,  0.04, 0.38); } // Arasaka: Cyan/Magenta
    else if (pi < 0.50) { bp = vec3(1.0,  0.43, 0.0);  bs = vec3(0.05, 0.65, 1.0);  } // Militech: Orange/Blau
    else if (pi < 0.75) { bp = vec3(0.82, 0.0,  1.0);  bs = vec3(0.0,  1.0,  0.38); } // Kang Tao: Violett/Grün
    else                { bp = vec3(1.0,  0.88, 0.0);  bs = vec3(0.0,  0.10, 0.55); } // Trauma Team: Gold/Blau

    // Scrollende Scan-Linien (holographischer Projektor-Effekt)
    float sv  = fract(uv.y * 72.0 - t * 2.6 + hash11(seed + 0.1) * 12.0);
    float scan = smoothstep(0.0, 0.10, sv) * smoothstep(0.40, 0.30, sv) * 0.30;

    // Hintergrund-Grid (Hologramm-Raster)
    float gx = step(0.94, fract(uv.x * 15.0)) + step(0.94, fract(uv.y * 8.5));
    float bg = clamp(gx, 0.0, 1.0) * 0.07;

    // Zentrales Polygon-Logo (rotierend, pro Gebäude-Seed)
    vec2  c     = uv - 0.5;
    float ang   = atan(c.y, c.x) + t * 0.38;
    float sides = 3.0 + floor(hash11(seed * 2.1) * 3.0);
    float halfA = 3.14159 / sides;
    float polyR = length(c) * cos(halfA) / max(0.001, cos(mod(ang, 2.0 * halfA) - halfA));
    float logoOutline = smoothstep(0.022, 0.0, abs(polyR - 0.22));
    float logoBg      = smoothstep(0.20, 0.10, polyR) * 0.35;
    float logoCore    = smoothstep(0.060, 0.0, polyR);

    // Pulsierende Ringe nach außen (Radar / Sensor)
    float rp   = fract(t * 1.15 + seed);
    float rp2  = fract(rp + 0.5);
    float ring1 = smoothstep(0.016, 0.0, abs(length(c) - rp  * 0.48)) * (1.0 - rp);
    float ring2 = smoothstep(0.016, 0.0, abs(length(c) - rp2 * 0.48)) * (1.0 - rp2);

    // Animierter Text-Streifen unten (Ticker)
    float tz   = step(0.07, uv.y) * (1.0 - step(0.22, uv.y));
    float ticker = step(0.47, fract(uv.x * 10.0 + floor(t * 2.8 + seed * 8.0) * 0.25)) * tz;

    // Firmen-Balken oben
    float topZ = step(0.82, uv.y) * (1.0 - step(0.97, uv.y));
    float topB = step(hash11(floor(uv.x * 11.0) + seed * 3.9), 0.55) * topZ;

    vec3 col = bp * ((logoOutline + logoCore * 0.85) * 4.8 + (ring1 + ring2) * 2.2)
             + bs * (logoBg * 2.8 + ticker * 2.5 + topB * 3.2)
             + bp *  scan
             + vec3(bg);

    col *= (2.6 + beat * 3.5);

    // Korruptions-Glitch: Zeilen-Versatz + Farb-Inversion
    float gRow  = floor(uv.y * 38.0);
    float gTick = floor(t * 13.0 + seed * 11.0);
    float gLine = step(0.89, hash12(vec2(gRow, gTick)));
    float gOff  = (hash12(vec2(gRow + 0.7, gTick)) - 0.5) * 0.14 * corrupt;
    float gUVx  = fract(uv.x + gOff);
    float gBit  = step(0.44, fract(gUVx * 8.0 + seed)) * (1.0 - step(0.95, uv.y));
    vec3 gCol   = mix(bs, vec3(1.0, 1.0, 0.9), hash11(gRow * 0.29 + gTick * 0.08)) * 7.0;
    col = mix(col, gCol * gBit, gLine * corrupt * 0.8);

    return col;
}

// ============================================================
// NEON-EDGE-TUBES — leuchtende Röhren an Gebäudekanten
// ============================================================
vec3 neonTubeEdge(vec2 uv, float normY, float seed, float t, float corrupt) {
    float el = uv.x;
    float er = 1.0 - uv.x;
    float et = 1.0 - uv.y;
    float eb = uv.y;
    float ed = min(min(el, er), min(et, eb));

    float g1 = exp(-ed * 22.0);
    float g2 = exp(-ed * 60.0);

    float cs = hash11(seed + 5.1);
    vec3 col1, col2;
    if      (cs < 0.20) col1 = vec3(0.0, 0.94, 1.0);
    else if (cs < 0.40) col1 = vec3(1.0, 0.04, 0.44);
    else if (cs < 0.60) col1 = vec3(1.0, 0.44, 0.0);
    else if (cs < 0.80) col1 = vec3(0.7, 0.0,  1.0);
    else                col1 = vec3(0.0, 1.0,  0.35);

    float cs2 = hash11(seed + 6.4);
    if      (cs2 < 0.20) col2 = vec3(1.0, 0.88, 0.0);
    else if (cs2 < 0.40) col2 = vec3(0.0, 0.94, 1.0);
    else if (cs2 < 0.60) col2 = vec3(1.0, 0.04, 0.44);
    else if (cs2 < 0.80) col2 = vec3(1.0, 0.44, 0.0);
    else                 col2 = vec3(0.7, 0.0,  1.0);

    vec3 tubeCol = mix(col1, col2, smoothstep(0.3, 0.7, normY));

    float flicker = 0.87 + sin(t * (2.2 + hash11(seed) * 5.5) + seed * 6.28) * 0.09
                  + hash11(seed + t * 0.5) * 0.04;
    float cFlick  = mix(1.0, step(0.38, fract(t * 9.5 + seed)), corrupt * 0.65);
    flicker      *= cFlick;

    float beatB = pow(max(0.0, 1.0 - uBeatPhase * 2.0), 2.0) * uBeatStrength;
    return tubeCol * (g1 * 0.55 + g2 * 1.8) * (2.4 + beatB * 2.8) * flicker;
}

// ============================================================
// REGEN-STREIFEN AUF FASSADEN
// ============================================================
float rainStreaks(vec2 uv, float t, float seed) {
    float result = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi  = float(i);
        float freq = 20.0 + fi * 10.0;
        float spd  = 2.0  + fi * 1.3;
        float col  = floor(uv.x * freq + hash11(fi + seed) * 80.0);
        float ph   = hash11(col * 0.39 + fi * 2.3 + seed);
        float yp   = fract(uv.y + t * spd * ph + hash11(col * 0.73 + seed) * 12.0);
        float stk  = exp(-yp * 20.0) * step(yp, 0.10);
        float wid  = exp(-abs(fract(uv.x * freq) - 0.5) * (9.0 + fi * 5.0));
        result    += stk * wid * (0.35 + ph * 0.45) / (fi + 1.0);
    }
    return result;
}

// ============================================================
// DACH-LOGO — Corporate Glow-Symbol auf Hochhäusern
// ============================================================
vec3 rooftopLogo(vec2 uv, float seed, float t) {
    vec2  c    = uv - 0.5;
    float dist = length(c);
    float ang  = atan(c.y, c.x);

    float outer = smoothstep(0.022, 0.0, abs(dist - 0.42));
    float inner = smoothstep(0.018, 0.0, abs(dist - 0.28));

    float spoke = 0.0;
    for (int s = 0; s < 4; s++) {
        float a   = float(s) * 3.14159 * 0.5;
        vec2  dir = vec2(cos(a), sin(a));
        float pr  = dot(c, dir);
        float pe  = length(c - dir * clamp(pr, 0.0, 0.38));
        spoke = max(spoke, smoothstep(0.020, 0.0, pe) * step(0.0, pr) * step(pr, 0.38));
    }
    float center = smoothstep(0.065, 0.0, dist);

    float cs = hash11(seed + 8.2);
    vec3 lc = (cs < 0.33) ? vec3(0.0, 0.9, 1.0)
            : (cs < 0.66) ? vec3(1.0, 0.04, 0.40)
                          : vec3(1.0, 0.65, 0.0);

    float pulse = 0.8 + sin(t * 1.5 + seed * 6.28) * 0.2;
    return lc * (outer + inner * 0.7 + spoke * 0.85 + center * 1.6) * pulse * 5.5;
}

// ============================================================
// MEGASTRUKTUR LED-STREIFEN (horizontal alle N Etagen)
// ============================================================
vec3 megaLedStrip(float normY, float h, float seed, float t, float corrupt) {
    float etage = normY * h;
    float sv    = fract(etage / 4.0);
    float strip = smoothstep(0.03, 0.0, abs(sv - 0.5) - 0.44);

    float cs = hash11(seed * 3.1);
    vec3 lc = (cs < 0.33) ? vec3(0.0, 0.88, 1.0)
            : (cs < 0.66) ? vec3(1.0, 0.04, 0.40)
                          : vec3(0.95, 0.55, 0.0);

    float segX  = floor(normY * h * 0.8);
    float segOn = smoothstep(0.3, 0.6, sin(t * 0.38 + segX * 0.73 + seed * 6.28) * 0.5 + 0.5);
    float pulse = 0.7 + sin(t * 1.85 + seed * 3.14) * 0.3;

    float beat = pow(max(0.0, 1.0 - uBeatPhase * 2.4), 2.4) * uBeatStrength;
    vec3 cc    = mix(vec3(0.0, 1.0, 0.28), vec3(1.0, 0.0, 0.82), sin(t * 0.5) * 0.5 + 0.5);
    lc         = mix(lc, cc, corrupt * 0.65);

    return lc * strip * segOn * pulse * (3.8 + beat * 3.5);
}

// ============================================================
// FLUG-FAHRZEUG-LICHTER (schwebende Autos / Drohnen)
// ============================================================
float flyingVehicleLights(vec3 wPos, float t, float seed) {
    float result = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi  = float(i);
        float h   = 10.0 + hash11(fi * 0.32 + seed) * 55.0;
        float spd = (hash11(fi * 0.74 + seed) * 1.8 + 0.4)
                  * (hash11(fi + 1.8) > 0.5 ? 1.0 : -1.0);
        float orb = 18.0 + hash11(fi * 0.52 + seed) * 58.0;
        float off = hash11(fi * 1.23 + seed) * 6.28318;
        float a   = t * spd * 0.16 + off;
        vec3  cp  = vec3(cos(a) * orb, h + sin(t * 0.4 + fi) * 1.5, sin(a) * orb);
        float d   = length(wPos - cp);
        result   += exp(-d * 0.55) * 0.30;
    }
    return result;
}

// ============================================================
// PARALLAX FENSTER-INTERIOR
// ============================================================
vec3 windowInterior(vec2 winUV, vec3 viewDir, vec3 N, float seed, float t) {
    vec3 tu  = normalize(vec3(0,1,0) - N * dot(N, vec3(0,1,0)));
    vec3 ts  = normalize(cross(N, tu));
    vec2 iUV = winUV + vec2(dot(viewDir, ts) * 0.28, dot(viewDir, tu) * 0.20);

    float wc = hash12(vec2(seed, floor(seed * 4.3)));
    vec3 roomCol = (wc < 0.35) ? vec3(1.0, 0.72, 0.38)   // warm orange
                : (wc < 0.68) ? vec3(0.4, 0.68, 1.0)     // kalt blau
                               : vec3(0.0, 1.0,  0.52);   // Hologramm-Grün

    float ceiling = smoothstep(0.75, 0.95, iUV.y) * 0.65;
    float rate    = hash11(seed + 0.33) * 5.0 + 1.5;
    float flicker = 0.82 + sin(t * rate + hash11(seed) * 6.28) * 0.13;

    // Hologramm flackert schnell
    float holoOff = (wc > 0.68) ? step(0.88, hash11(seed + floor(t * 9.0) * 0.1)) : 0.0;
    flicker      *= max(0.15, 1.0 - holoOff);

    return roomCol * flicker * (1.0 - ceiling * 0.60);
}

// ============================================================
// GLAS-FASSADE (Fresnel + Stadt-Reflexion)
// ============================================================
vec3 glassFacade(vec3 N, vec3 V, float t, float beat, float corrupt) {
    float ct     = max(dot(N, V), 0.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - ct, 5.0);
    vec3  R       = reflect(-V, N);
    float hR      = R.y * 0.5 + 0.5;

    // Tiefer Indigo-Nachthimmel
    vec3 sky = mix(vec3(0.07, 0.025, 0.16), vec3(0.004, 0.003, 0.022), pow(hR, 0.45));

    // Zufällige Neon-Reflexe (CP2077-Palette)
    float nr1 = hash12(R.xz * 4.5 + floor(t * 0.35) * 0.1);
    float nr2 = hash12(R.xz * 3.2 + floor(t * 0.35 + 0.5) * 0.1);
    sky += mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.04, 0.44), nr1) * step(0.62, nr1) * 0.45;
    sky += mix(vec3(1.0, 0.44, 0.0), vec3(0.75, 0.0, 1.0), nr2) * step(0.65, nr2) * 0.32;

    vec3 cr = mix(vec3(0.0, 0.88, 0.3), vec3(0.88, 0.0, 1.0), sin(t * 0.38) * 0.5 + 0.5);
    sky  = mix(sky, sky + cr * 0.55, corrupt);
    sky += vec3(0.08, 0.25, 1.0) * beat * 0.3;

    return sky * (fresnel + 0.08);
}

// ============================================================
// BETON-PANEL (Voronoi)
// ============================================================
float concretePanel(vec2 uv, float seed, float scale) {
    vec2  vc   = voronoi2(uv * scale + seed * 3.7);
    float jt   = 1.0 - smoothstep(0.03, 0.10, vc.x);
    float agg  = fbm2(uv * scale * 5.0 + vc.y + seed, 4, 2.0, 0.48);
    return mix(agg, 0.0, jt * 0.85);
}

// ============================================================
// BRUSHED METAL BRDF (anisotrop, für Industrial)
// ============================================================
vec3 brushedMetalSpec(vec3 N, vec3 V, vec3 L, float aniso) {
    vec3  H   = normalize(V + L);
    float NdH = max(dot(N, H), 0.0);
    float NdL = max(dot(N, L), 0.0);
    float NdV = max(dot(N, V), 0.0);
    float VdH = max(dot(V, H), 0.0);
    vec3  up  = vec3(0.0, 1.0, 0.0);
    vec3  T   = normalize(cross(N, up) + 0.001 * N);
    float TdH = dot(T, H);
    float rx  = mix(0.06, 0.55, 1.0 - aniso);
    float ry  = 0.50;
    float sx  = max(0.0, 1.0 - TdH * TdH);
    float sy  = max(0.0, 1.0 - NdH * NdH);
    float D   = exp(-(sx / (rx * rx) + sy / (ry * ry))) / (PI * rx * ry);
    float G   = min(1.0, min(2.0 * NdH * NdV / (VdH + 0.001),
                             2.0 * NdH * NdL / (VdH + 0.001)));
    vec3  F   = vec3(0.62) + (1.0 - vec3(0.62)) * pow(1.0 - VdH, 5.0);
    return (D * G * F) / (4.0 * NdV * NdL + 0.001) * NdL;
}

// ============================================================
// KRISTALLINE KORRUPTION
// ============================================================
vec3 crystallineCorruption(vec3 wPos, float corrupt, float t, float barPhase) {
    float f1 = domainWarpFbm(wPos * 0.52 + t * 0.032, 5);
    float f2 = fbm3(wPos * 3.0 - t * 0.050, 4, 2.0, 0.5);
    float f3 = vnoise3(wPos * 7.5 + t * 0.075) * 0.5 + 0.5;

    float fc1 = pow(max(0.0, f1 - 0.42), 2.6);
    float fc2 = pow(max(0.0, 0.94 - f1), 9.0) * pow(f3, 2.0);
    float fc3 = smoothstep(0.46, 0.52, f2) * fc1;

    vec3 cA = mix(vec3(0.0, 1.0, 0.22), vec3(0.9, 0.0, 1.0),  barPhase);
    vec3 cB = mix(vec3(0.0, 0.5, 1.0),  vec3(1.0, 0.22, 0.0), barPhase);
    vec3 cC = vec3(1.0, 1.0, 0.95);

    float beat = pow(max(0.0, 1.0 - uBeatPhase * 2.2), 2.0) * uBeatStrength;
    return (cA * fc1 + cB * fc3 + cC * fc2 * 3.5)
           * pow(corrupt, 1.3) * (1.0 + beat * 2.5) * 5.0;
}

// ============================================================
// STADTDUNST (Volumetrischer Neon-Fog)
// ============================================================
vec3 cityFog(float dist, float h, float corrupt) {
    float gf  = exp(-max(0.0, h + 7.0) * 0.12);
    float mf  = exp(-abs(h - 5.0) * 0.08) * 0.4;
    float hig = exp(-max(0.0, h - 22.0) * 0.04) * 0.14;

    vec3 gc = mix(vec3(0.062, 0.020, 0.010), vec3(0.080, 0.012, 0.028), corrupt);
    vec3 mc = mix(vec3(0.022, 0.010, 0.048), vec3(0.012, 0.055, 0.022), corrupt);
    vec3 hc = vec3(0.004, 0.003, 0.018);

    return gc * gf + mc * mf + hc * hig;
}

// ============================================================
// MAIN
// ============================================================
void main() {
    vec3  N      = normalize(vNormal);
    vec3  V      = normalize(uCameraPos - vWorldPos);
    float btype  = vBuildingType;
    float corrupt = vCorruption;
    float seed   = vSeed;

    float beat   = pow(max(0.0, 1.0 - uBeatPhase * 2.0), 2.0) * uBeatStrength;
    float barP   = pow(max(0.0, 1.0 - uBarPhase  * 5.0), 3.0) * uBeatStrength;

    // ─── LICHTQUELLEN ────────────────────────────────────────────────────────
    vec3 moonDir = normalize(vec3(0.30, 0.76, 0.40));
    vec3 moonCol = vec3(0.38, 0.50, 0.84) * 2.1;

    vec3 fillDir = normalize(vec3(-0.12, -0.58, 0.25));
    vec3 fillCol = mix(vec3(0.34, 0.11, 0.05), vec3(0.26, 0.05, 0.42), corrupt) * 0.68;

    vec3 corDir  = normalize(vec3(sin(uTime * 0.20), 0.28, cos(uTime * 0.20)));
    vec3 corCol  = mix(vec3(0.0, 0.85, 0.3), vec3(0.75, 0.0, 1.0), uBarPhase)
                 * corrupt * (1.3 + beat * 1.8);

    vec3 neonDir = normalize(vec3(sin(uTime * 0.11 + 1.0), 0.18, cos(uTime * 0.11 + 1.0)));
    vec3 neonCol = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.04, 0.44),
                       sin(uTime * 0.22) * 0.5 + 0.5) * 1.9;

    // ─── MATERIAL PRO TYP ────────────────────────────────────────────────────
    vec3  albedo    = vec3(0.07);
    float metallic  = 0.0;
    float roughness = 0.82;
    vec3  emission  = vec3(0.0);

    // TYPE 0: BRUTALIST BETON
    if (btype < 0.5) {
        float p1 = concretePanel(vUV, seed, 3.0);
        float p2 = concretePanel(vUV * 2.2 + 0.3, seed, 5.5);
        vec3 cb = mix(vec3(0.28, 0.25, 0.21), vec3(0.13, 0.12, 0.10), p1 * 0.7 + p2 * 0.3);
        float stain = pow(fbm2(vec2(vUV.x, vUV.y * 0.22) * 2.8 + seed, 3, 2.0, 0.5), 1.7);
        cb = mix(cb, cb * vec3(0.52, 0.58, 0.52), stain * 0.45);
        vec3 cm = mix(vec3(0.04, 0.27, 0.07), vec3(0.40, 0.0, 0.58),
                      domainWarpFbm(vWorldPos * 0.22 + seed, 3));
        albedo    = mix(cb, cm, corrupt * 0.76);
        metallic  = mix(0.0, 0.30, corrupt);
        roughness = mix(0.90, 0.28, corrupt);
    }

    // TYPE 1: GLAS-TURM
    else if (btype < 1.5) {
        float cols = 7.0;
        float rows = max(1.0, vHeight * 0.36);
        vec2  gg   = fract(vUV * vec2(cols, rows));
        float glass = smoothstep(0.03, 0.07, gg.x) * smoothstep(0.97, 0.93, gg.x)
                    * smoothstep(0.04, 0.08, gg.y) * smoothstep(0.96, 0.92, gg.y);
        vec3 frame = mix(vec3(0.07, 0.07, 0.11), vec3(0.24, 0.13, 0.05), corrupt);
        albedo    = mix(frame, glassFacade(N, V, uTime, beat, corrupt), glass);
        metallic  = mix(0.93, 0.22, glass);
        roughness = mix(0.11, 0.52, glass * (1.0 - corrupt * 0.45));
        emission += mix(vec3(0.0), vec3(0.0, 0.44, 1.0), corrupt * glass * 0.45) * (1.0 + beat);
    }

    // TYPE 2: INDUSTRIAL STAHL
    else if (btype < 2.5) {
        float brushV = fbm2(vec2(vUV.x * 20.0 + seed, vUV.y * 0.28), 3, 2.0, 0.5);
        float bandH  = fract(vNormalizedY * vHeight * 0.65);
        float bm     = smoothstep(0.0, 0.07, bandH) * smoothstep(1.0, 0.93, bandH);
        vec3 steel = mix(vec3(0.06, 0.07, 0.09),
                         mix(vec3(0.13, 0.15, 0.18), vec3(0.22, 0.24, 0.28), brushV), bm);
        float rust = pow(fbm2(vUV * 3.8 + seed * 2.6, 3, 2.0, 0.5), 2.0);
        steel = mix(steel, vec3(0.35, 0.13, 0.04), rust * 0.38);

        // CP2077 Warn-Streifen (gelb-schwarz)
        float wf   = vHeight * 0.35;
        float wb   = step(0.72, fract(vNormalizedY * wf)) * (1.0 - abs(vNormal.y));
        float wc   = step(0.5, fract(vUV.x * 4.0));
        steel = mix(steel, mix(vec3(0.06, 0.05, 0.04), vec3(1.0, 0.82, 0.0), wc), wb * 0.70);

        albedo    = mix(steel, vec3(0.04, 0.35, 0.16), corrupt * 0.50);
        metallic  = mix(0.85, 0.65, rust + corrupt * 0.22);
        roughness = mix(0.25, 0.48, rust + corrupt * 0.28);

        // Abgas-Glühen oben
        float exh = step(abs(vNormal.y - 1.0), 0.25) * step(0.88, vNormalizedY);
        emission += vec3(1.0, 0.33, 0.04) * exh
                  * (2.2 + beat * 3.2) * (0.6 + sin(uTime * 2.4 + seed * 6.28) * 0.4);
    }

    // TYPE 3: MIXED
    else if (btype < 3.5) {
        float isP  = 1.0 - smoothstep(0.24, 0.30, vNormalizedY);
        float gran = fbm2(vUV * 12.0 + seed, 5, 2.0, 0.5);
        vec2  gv   = voronoi2(vUV * 5.5 + seed * 2.0);
        vec3 granite = mix(vec3(0.22, 0.19, 0.17),
                           vec3(0.09, 0.08, 0.09),
                           gran * 0.55 + (1.0 - gv.x) * 0.45);
        vec3 tower = mix(vec3(0.04, 0.03, 0.08), vec3(0.09, 0.02, 0.15), corrupt);
        albedo    = mix(tower, granite, isP);
        metallic  = mix(mix(0.72, 0.02, isP), 0.50, corrupt);
        roughness = mix(mix(0.16, 0.82, isP), 0.26, corrupt);
    }

    // TYPE 4: BILLBOARD PILLAR
    else if (btype < 4.5) {
        float frame = 1.0 - smoothstep(0.03, 0.07,
                          min(vUV.x, min(1.0 - vUV.x, min(vUV.y, 1.0 - vUV.y))));
        albedo    = vec3(0.05, 0.05, 0.07) * (1.0 + frame * 0.5);
        metallic  = 0.80;
        roughness = 0.18;
    }

    // TYPE 5: MEGASTRUKTUR
    else {
        float macro = concretePanel(vUV * 0.5, seed, 1.5);
        float micro = concretePanel(vUV * 2.0, seed, 4.0) * 0.28
                    + concretePanel(vUV * 6.0, seed, 8.0) * 0.14;
        vec3 mb = mix(vec3(0.16, 0.14, 0.12), vec3(0.07, 0.07, 0.07),
                      macro * 0.55 + micro);
        float age = pow(fbm2(vec2(vUV.x, vUV.y * 0.18) * 2.2 + seed, 4, 2.0, 0.5), 1.8);
        mb = mix(mb, mb * vec3(0.40, 0.42, 0.38), age * 0.55);
        float mz = smoothstep(0.42, 0.48, fbm2(vUV * 1.8 + seed * 2.0, 3, 2.0, 0.5));
        mb = mix(mb, vec3(0.12, 0.13, 0.15), mz * 0.40);
        vec3 cm = mix(vec3(0.05, 0.30, 0.10), vec3(0.40, 0.0, 0.58),
                      domainWarpFbm(vWorldPos * 0.18 + seed, 3));
        albedo    = mix(mb, cm, corrupt * 0.80);
        metallic  = mix(mz * 0.35, 0.55, corrupt);
        roughness = mix(0.88, 0.25, corrupt + mz * 0.25);

        // LED-Streifen nur auf Seitenwänden
        emission += megaLedStrip(vNormalizedY, vHeight, seed, uTime, corrupt)
                  * step(abs(vNormal.y), 0.25);
    }

    // ─── FENSTER-SYSTEM ───────────────────────────────────────────────────────
    float isWall = step(abs(vNormal.y), 0.28);

    // Billboard-Pfeiler (Typ 4) braucht kein normales Fenstersystem
    if (btype < 3.5 || btype >= 4.5) {
        float wc  = (btype < 0.5)  ? 5.0
                  : (btype < 1.5)  ? 7.0
                  : (btype < 2.5)  ? 3.0
                  : (btype < 3.5)  ? 6.0
                  :                  9.0;   // Megastruktur: sehr dicht
        float wr   = max(1.0, floor(vHeight * 0.44));
        vec2  wg   = vUV * vec2(wc, wr);
        vec2  wce  = floor(wg);
        vec2  wuv  = fract(wg);
        float wm   = step(0.07, wuv.x) * step(wuv.x, 0.93)
                   * step(0.10, wuv.y) * step(wuv.y, 0.90);
        float ws   = hash12(wce + vec2(seed * 13.5, seed * 7.1));
        float won  = step(0.16, ws);

        vec3 viewDir  = normalize(uCameraPos - vWorldPos);
        vec3 interior = windowInterior(wuv, viewDir, N, ws, uTime);
        float wmask   = wm * won * isWall;
        if (btype >= 0.5 && btype < 1.5) wmask *= 0.42;
        emission += interior * wmask * (btype >= 4.5 ? 3.0 : 4.2);
    }

    // ─── NEON-KANTEN-TUBES ────────────────────────────────────────────────────
    // Alle Typen 0-4, auf Seitenwänden, zufällig (ca. 75% der Gebäude)
    if (btype < 4.5 && isWall > 0.5 && hash11(seed + 4.8) > 0.25) {
        emission += neonTubeEdge(vUV, vNormalizedY, seed, uTime, corrupt);
    }

    // ─── HOLO-BILLBOARD ───────────────────────────────────────────────────────
    // Typ 4 immer, andere große Gebäude zufällig (30% wenn h > 18)
    bool isBb = (btype >= 3.5 && btype < 4.5);
    bool hasBb = isBb
              || (isWall > 0.5 && hash11(seed + 9.1) > 0.70
                  && vHeight > 18.0
                  && vNormalizedY > 0.25 && vNormalizedY < 0.85);

    if (hasBb) {
        vec2 buv = vUV;
        if (!isBb) {
            // Werbefläche: mittlere Zone der Fassade
            buv.y = clamp((vNormalizedY - 0.25) / 0.60, 0.0, 1.0);
            float xc  = 0.25 + hash11(seed + 9.5) * 0.50;
            float xw  = 0.18 + hash11(seed + 9.8) * 0.24;
            buv.x = (vUV.x - (xc - xw)) / (xw * 2.0);
        }
        if (buv.x >= 0.0 && buv.x <= 1.0 && buv.y >= 0.0 && buv.y <= 1.0) {
            float bs  = isBb ? seed : hash11(seed + 9.3);
            vec3 holo = holoBillboard(buv, bs, uTime, corrupt, beat);
            if (isBb) {
                emission += holo * 1.3;
                albedo = vec3(0.01);
            } else {
                emission += holo * 0.85;
            }
        }
    }

    // ─── DACH-LOGO ────────────────────────────────────────────────────────────
    float isRoof = step(abs(vNormal.y - 1.0), 0.2);
    if (isRoof > 0.5 && (btype >= 0.5 && btype < 1.5 || btype >= 4.5)) {
        emission += rooftopLogo(vUV, seed, uTime) * isRoof;
    }
    // Rote Blink-LEDs auf Antennen
    float blink = step(0.68, hash11(seed + 0.55))
                * (sin(uTime * (1.6 + hash11(seed) * 3.5)) * 0.5 + 0.5);
    emission += vec3(1.0, 0.04, 0.04) * blink * isRoof * step(0.92, vNormalizedY) * 7.5;

    // ─── REGEN AUF FASSADE ────────────────────────────────────────────────────
    emission += vec3(0.38, 0.52, 0.90) * rainStreaks(vUV, uTime * 0.55, seed) * 0.17
              * isWall * (1.0 - corrupt * 0.5);

    // ─── FLUG-FAHRZEUG-LICHTER ────────────────────────────────────────────────
    float fl = flyingVehicleLights(vWorldPos, uTime, seed);
    emission += mix(vec3(1.0, 0.85, 0.58), vec3(0.38, 0.80, 1.0), fract(seed * 7.5))
              * fl * 0.42;

    // ─── KRISTALLINE KORRUPTION ───────────────────────────────────────────────
    emission += crystallineCorruption(vWorldPos, corrupt, uTime, uBarPhase);

    // ─── PBR SHADING ─────────────────────────────────────────────────────────
    vec3 shading = cookTorrance(N, V, moonDir,  albedo, metallic, roughness) * moonCol
                 + cookTorrance(N, V, -fillDir, albedo, metallic, roughness) * fillCol
                 + cookTorrance(N, V, neonDir,  albedo, metallic, roughness) * neonCol
                   * (0.28 + beat * 0.72)
                 + cookTorrance(N, V, corDir,   albedo, metallic, roughness) * corCol;

    if (btype >= 1.5 && btype < 2.5) {
        shading += brushedMetalSpec(N, V, moonDir, 0.70) * moonCol * metallic * 0.55;
    }

    // Ambiente: Indigo-Nachthimmel + Neon-Boden-Glow
    vec3 envSky = vec3(0.005, 0.004, 0.022);
    vec3 envGnd = mix(vec3(0.050, 0.018, 0.009), vec3(0.014, 0.060, 0.012), corrupt);
    shading += albedo * mix(envGnd, envSky, vNormal.y * 0.5 + 0.5) * (1.0 - metallic * 0.5);

    shading += emission;

    // Bar-Blitz
    shading += mix(vec3(0.06, 0.03, 0.22), vec3(0.0, 0.12, 0.06), corrupt) * barP * 0.55;

    // Holy-Shit-Phase
    shading += mix(vec3(0.3, 0.0, 0.8), vec3(0.0, 0.8, 1.0),
                   sin(uTime * 3.0) * 0.5 + 0.5) * uHolyShitPhase * 2.8;

    // ─── ATMOSPHÄRISCHER NEBEL ────────────────────────────────────────────────
    float dist = length(uCameraPos - vWorldPos);
    vec3  fog  = cityFog(dist, vWorldPos.y, corrupt);
    shading    = mix(shading, fog, 1.0 - exp(-dist * 0.0065));

    fragColor = vec4(shading, 1.0);
}
