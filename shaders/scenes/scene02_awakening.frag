#version 460 core
// SCENE 2: AWAKENING CORE (0:20-0:45, 25 Sekunden @ 133 BPM)
// Kinematische Kamera, BPM-Shockwaves, fixierter Debris-Material-ID-Bug
// Material-IDs: 1=Monolith, 2=Energy-Core, 3=Boden, 4=Debris

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

// -------- SDF-Szene --------
vec2 sdScene(vec3 p) {
    // --- Monolith ---
    float warp = fbm3(p * 0.45 + vec3(uTime * 0.07, 0.0, uTime * 0.05), 4, 2.0, 0.5);
    vec3 mp = p + vec3(warp, 0.0, warp) * uProgress * 0.35;
    mp = opTwist(mp + vec3(0.0, -1.0, 0.0), warp * 0.025 * uProgress);
    float monolith = sdBox(mp, vec3(1.35, 6.8, 0.48));

    // Beat-Ripple auf der Oberfläche
    float surfRipple = sin(p.y * 2.8 - uTime * 18.0) * 0.022
                     * (1.0 - uBeatPhase) * uBeatStrength;
    monolith += surfRipple;

    // Fraktale Oberflächendetails wachsen mit Progress
    float detail = fbm3(p * 5.5 + uTime * 0.03, 4, 2.0, 0.5) * 0.055 * uProgress;
    monolith += detail;

    // --- Energy Core ---
    float coreBase = 0.38 * smoothstep(0.0, 0.45, uProgress);
    // Puls MIT beatPhase (nicht mit rohéer Frequenz!)
    float corePulse = 1.0 + 0.18 * (1.0 - uBeatPhase) * uBeatStrength;

    float core1 = sdSphere(p + vec3(0.0, -1.8, 0.0), coreBase * corePulse);
    float core2 = sdSphere(p + vec3(0.0,  0.3, 0.0), coreBase * 0.55 * corePulse);
    float core3 = sdSphere(p + vec3(0.0,  2.2, 0.0), coreBase * 0.28 * corePulse);
    float core  = smin(core1, smin(core2, core3, 0.65), 0.85);

    // --- Boden ---
    float hexRel = hexGrid(p.xz * 0.42 + 0.5, 11.0) * 0.07;
    float ground = p.y + 7.2 + hexRel;

    // --- Debris (12 Fragmente, Material-ID 4 — vorher war der Zweig unerreichbar) ---
    float debris = 1e10;
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float orbitBoost = 1.0 + uBeatStrength * 0.45 * (1.0 - uBeatPhase);
        float ang = fi * 2.399 + uTime * (0.22 + fi * 0.025) * orbitBoost;
        float radius = 2.2 + fi * 0.18;
        float height = cos(fi * 1.73 + uTime * (0.28 + fi * 0.018)) * 2.8 - 0.8;
        vec3 dpos = vec3(sin(ang) * radius, height, cos(ang) * radius);
        float dr = 0.045 + 0.09 * hash11(fi * 0.719);
        float appear = smoothstep(0.0, 0.55, uProgress - fi * 0.018);
        debris = min(debris, sdSphere(p - dpos, dr * appear));
    }

    vec2 res = sminMat(vec2(monolith, 1.0), vec2(core,   2.0), 0.4);
    res       = sminMat(res,                 vec2(ground, 3.0), 0.2);
    res       = sminMat(res,                 vec2(debris, 4.0), 0.1);
    return res;
}

// -------- Raymarcher --------
vec2 rayMarch(vec3 ro, vec3 rd) {
    float t = 0.01, matID = 0.0;
    for (int i = 0; i < 96; i++) {
        vec2 h = sdScene(ro + rd * t);
        if (h.x < 0.0018) { matID = h.y; break; }
        if (t > 52.0) break;
        t += h.x * 0.88;
    }
    return vec2(t, matID);
}

vec3 calcNormal(vec3 p) {
    const float e = 0.001;
    return normalize(vec3(
        sdScene(p+vec3(e,0,0)).x - sdScene(p-vec3(e,0,0)).x,
        sdScene(p+vec3(0,e,0)).x - sdScene(p-vec3(0,e,0)).x,
        sdScene(p+vec3(0,0,e)).x - sdScene(p-vec3(0,0,e)).x));
}

float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.14 * float(i) / 4.0;
        float d = sdScene(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.93;
    }
    return clamp(1.0 - 2.8 * occ, 0.0, 1.0);
}

// -------- Volumetrische God Rays + Plasma-Wellen --------
float godRays(vec3 ro, vec3 rd, vec3 lightPos, float boost) {
    float rays = 0.0, t = 0.3;
    for (int i = 0; i < 36; i++) {
        vec3 pos = ro + rd * t;
        float dist = length(pos - lightPos);
        float scatter = exp(-dist * 0.22) * (1.0 + boost * 1.5);
        float noiseVal = vnoise3(pos * 1.4 + uTime * 0.07) * 0.55 + 0.45;
        float heightFade = exp(-abs(pos.y - lightPos.y) * 0.18);
        rays += scatter * noiseVal * heightFade * 0.028;
        t += 0.42;
    }
    return rays;
}

// -------- Plasma-Wellen vom Core (neue Wow-Effekt) --------
float plasmaWave(vec3 pos, float beatPhase, float beatStrength) {
    float coreY = -1.8;
    float r = length(vec2(pos.x, pos.z));
    float waveR = beatPhase * 18.0;
    float waveFront = abs(r - waveR) - 0.15 * (1.0 - beatPhase);
    float plasma = exp(-waveFront * waveFront * 20.0) * (1.0 - beatPhase) * beatStrength * 1.8;

    float heightDist = abs(pos.y - coreY);
    float heightMod = exp(-heightDist * 0.08);
    return plasma * heightMod;
}

// -------- Prismen-Licht-Brechung (Farb-Spektrum) --------
vec3 prismLight(vec3 rd, float t, float progress) {
    float hueShift = sin(rd.x * 15.0 + rd.y * 20.0 + t * 0.8) * 0.5 + 0.5;
    vec3 spectrum = vec3(
        sin(hueShift * 3.14 + 0.0) * 0.5 + 0.5,
        sin(hueShift * 3.14 + 2.0) * 0.5 + 0.5,
        sin(hueShift * 3.14 + 4.0) * 0.5 + 0.5
    );
    return spectrum * progress * 0.35;
}

// -------- BPM-Shockwave-Ringe auf dem Boden --------
float shockwaveRing(vec3 pos, float beatPhase, float strength) {
    float radius = beatPhase * 14.0;
    float ring   = abs(length(pos.xz) - radius);
    float width  = 0.25 + beatPhase * 0.6;
    return exp(-ring / width) * (1.0 - beatPhase) * strength;
}

// -------- Atmosphäre --------
vec3 skyColor(vec3 rd, float progress) {
    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horiN = vec3(0.018, 0.025, 0.10);
    vec3 zenN  = vec3(0.000, 0.000, 0.028);
    vec3 horiA = vec3(0.045, 0.015, 0.18);
    vec3 zenA  = vec3(0.008, 0.000, 0.09);
    return mix(mix(horiN, horiA, progress), mix(zenN, zenA, progress), pow(h, 0.38));
}

// -------- Kinematische Kamera: 3 dramatische Bewegungsphasen --------
vec3 getCameraPos(float progress, float sceneTime, float beatBoost) {
    float nudge = beatBoost * 0.08;

    if (progress < 0.30) {
        // Phase 1: Vogelperspektive stürzt hinab auf den Monolith
        float t = progress / 0.30;
        float ease = t * t * (3.0 - 2.0 * t); // smoothstep-artig
        float height = mix(20.0, 7.5, ease);
        float dist   = mix(1.5, 5.0, ease);
        float ang    = sceneTime * 0.14;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    }
    else if (progress < 0.68) {
        // Phase 2: Seitenorbit, nähert sich an, dramatisch niedrig
        float t = (progress - 0.30) / 0.38;
        float ease = t * t * (3.0 - 2.0 * t);
        float height = mix(7.5, 1.8, ease);
        float dist   = mix(5.0, 9.0, ease);
        float ang    = sceneTime * 0.22 + 0.55;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    }
    else {
        // Phase 3: Großes Zurückfahren — volle Silhouette sichtbar
        float t = (progress - 0.68) / 0.32;
        float ease = t * t * (3.0 - 2.0 * t);
        float height = mix(1.8, 5.5, ease);
        float dist   = mix(9.0, 14.0, ease);
        float ang    = sceneTime * 0.18 + 2.1;
        return vec3(sin(ang) * dist + nudge, height, cos(ang) * dist);
    }
}

void main() {
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // Beat-Boost: stark bei Onset, klingt innerhalb eines Beats ab
    float beatBoost = uBeatStrength * max(0.0, 1.0 - uBeatPhase * 2.2);

    // === KINEMATISCHE KAMERA ===
    vec3 ro     = getCameraPos(uProgress, uSceneTime, beatBoost);
    vec3 target = vec3(0.0, 0.8, 0.0);
    vec3 fwd    = normalize(target - ro);
    vec3 right  = normalize(cross(fwd, vec3(0,1,0)));
    vec3 up     = cross(right, fwd);

    // FOV weitet sich auf Nahaufnahme, zieht sich bei Rückfahrt zusammen
    float fovDeg = 52.0 + uProgress * 14.0;
    float fovTan = tan(radians(fovDeg) * 0.5);

    // BPM-Kamera-Shake: kontrolliert, nicht unangenehm
    float shake = beatBoost * 0.012;
    vec2 shakeOff = vec2(sin(uTime * 79.0), cos(uTime * 67.0)) * shake;

    vec3 rd = normalize(fwd
        + (ndc.x + shakeOff.x) * right * fovTan
        + (ndc.y + shakeOff.y) * up    * fovTan);

    vec3 col = skyColor(rd, uProgress);

    // === RAYMARCH ===
    vec2 hit   = rayMarch(ro, rd);
    float t    = hit.x;
    float matID = hit.y;

    // Lichtquellen
    vec3 lightPos    = vec3(4.5 * sin(uTime * 0.22), 8.0, 4.5 * cos(uTime * 0.22));
    vec3 rimLightPos = vec3(-lightPos.x * 0.8, lightPos.y * 0.4, -lightPos.z * 0.8);
    vec3 fillPos     = vec3(0.0, -2.0, 8.0); // Aufhellung von unten-vorne

    if (matID > 0.0 && t < 52.0) {
        vec3 pos = ro + rd * t;
        vec3 N   = calcNormal(pos);
        vec3 V   = -rd;
        float ao = calcAO(pos, N);

        vec3 L    = normalize(lightPos    - pos);
        vec3 Lrim = normalize(rimLightPos - pos);
        vec3 Lfill = normalize(fillPos   - pos);

        float rimFresnel = pow(max(0.0, 1.0 - dot(N, V)), 2.8);
        float rimPulse   = 1.0 + beatBoost * 2.5;

        if (matID < 1.5) {
            // === MONOLITH — dunkles Obsidian mit Energie-Rissen ===
            vec3 albedo = vec3(0.018, 0.018, 0.038);
            float rough = 0.22, metal = 0.96;

            vec3 mainLight = vec3(0.65, 0.80, 1.0) * 4.5;
            vec3 rimLight  = vec3(0.25, 0.45, 1.0) * 3.5 * rimPulse;
            vec3 fillLight = vec3(0.08, 0.15, 0.45) * 1.5;

            vec3 shade = cookTorrance(N, V, L,     albedo, metal, rough) * mainLight
                       + cookTorrance(N, V, Lrim,  albedo, metal, rough) * rimLight
                       + cookTorrance(N, V, Lfill, albedo, metal, rough) * fillLight;
            vec3 env = envLighting(N, V, albedo, metal, rough,
                vec3(0.035, 0.055, 0.20), vec3(0.008, 0.008, 0.030));

            // Energie-Risse: domain-warped FBM → dünne Emissionslinien
            float crack1 = domainWarpFbm(pos * 2.8 + uTime * 0.09, 4);
            float crack2 = fbm3(pos * 7.0 - uTime * 0.07, 3, 2.0, 0.5);
            float crackLine = pow(max(0.0, crack1 - 0.42), 3.0)
                            * pow(max(0.0, crack2 - 0.28), 2.0);
            float crackAmt = uProgress * (1.0 + beatBoost * 0.6);
            vec3 crackCol = mix(vec3(0.0, 0.62, 1.0), vec3(0.55, 0.15, 1.0), uBarPhase);
            vec3 emission = crackCol * crackLine * crackAmt * 5.0;

            // Rim-Glow auf jedem Beat
            emission += crackCol * rimFresnel * rimPulse * uProgress * 0.9;

            col = shade + env * ao + emission;
        }
        else if (matID < 2.5) {
            // === ENERGY CORE — weißheiße Plasma-Kugel ===
            vec3 hot  = mix(vec3(0.55, 0.88, 1.0), vec3(1.0, 0.95, 0.7),
                            sin(uTime * 3.5) * 0.5 + 0.5);
            vec3 cool = mix(vec3(0.0, 0.42, 1.0), vec3(0.38, 0.0, 1.0), uBarPhase);

            float pulse = 1.0 + 0.4 * (1.0 - uBeatPhase) * uBeatStrength;
            float glow  = fbm3(pos * 5.5 + uTime * 0.28, 2, 2.0, 0.5);

            col = mix(cool, hot, glow) * (9.0 + beatBoost * 7.0) * pulse;
        }
        else if (matID < 3.5) {
            // === BODEN — dunkle Hex-Kacheln mit Shockwave-Ringen ===
            vec3 albedo = vec3(0.028, 0.028, 0.048);
            float m = 0.82, r = 0.32;
            vec3 shade = cookTorrance(N, V, L, albedo, m, r) * vec3(0.55, 0.75, 1.0) * 3.2;
            vec3 env   = envLighting(N, V, albedo, m, r,
                vec3(0.018, 0.038, 0.12), vec3(0.008));

            float hexGlow = hexGrid(pos.xz * 0.42 + 0.5, 11.0);
            float shock   = shockwaveRing(pos, uBeatPhase, uBeatStrength);
            vec3 shockCol = mix(vec3(0.0, 0.5, 1.0), vec3(0.45, 0.0, 1.0), uBarPhase);

            col = shade + env * ao
                + vec3(0.0, 0.52, 1.0) * hexGlow * 0.55 * uProgress
                + shockCol * shock * 1.8;
        }
        else {
            // === DEBRIS — leuchtende Fragmente (mat 4, vorher unerreichbar!) ===
            float dHash = hash12(pos.xy + pos.z * 0.37);
            vec3 dCol   = mix(vec3(0.12, 0.52, 1.0), vec3(0.68, 0.18, 1.0), dHash);
            float dPulse = 1.0 + beatBoost * dHash * 1.5;
            // Rim-Glow auf Debris
            vec3 drim = dCol * rimFresnel * 2.0;
            col = dCol * (3.5 + dPulse * 2.5) + drim;
        }

        // Nebel
        float fog = 1.0 - exp(-t * 0.014);
        col = mix(col, skyColor(rd, uProgress), fog);
    }

    // === GOD RAYS — vom Core + vom Monolith-Kopf ===
    float rays1 = godRays(ro, rd, vec3(0.0, -0.5, 0.0), beatBoost);
    float rays2 = godRays(ro, rd, vec3(0.0,  6.8, 0.0), beatBoost * 0.4)
                * smoothstep(0.35, 0.75, uProgress);
    vec3 rayCol = mix(vec3(0.18, 0.58, 1.0), vec3(0.38, 0.12, 1.0), uBarPhase);
    col += rayCol * rays1 * uProgress * 3.5;
    col += vec3(0.28, 0.48, 1.0) * rays2 * 1.8;

    // === PLASMA-WELLEN + PRISMEN-LICHT (WOW-EFFEKT) ===
    float plasma = 0.0;
    for (int i = 0; i < 4; i++) {
        vec3 wavePos = ro + rd * (t + float(i) * 2.0);
        plasma += plasmaWave(wavePos, uBeatPhase, uBeatStrength) * 0.25;
    }
    vec3 plasmaCol = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.2, 1.0), uBarPhase * 0.6);
    col += plasmaCol * plasma * 4.5;

    // Prismen-Licht-Brechung
    col += prismLight(rd, uTime, uProgress);

    // === BPM-SCREEN-FLASH ===
    float barFlash  = pow(max(0.0, 1.0 - uBarPhase  * 7.0), 3.0) * 0.45
                    * smoothstep(0.25, 0.55, uProgress);
    float beatFlash = pow(max(0.0, 1.0 - uBeatPhase * 4.5), 4.0) * 0.22 * uBeatStrength;
    vec3 flashCol = mix(vec3(0.28, 0.58, 1.0), vec3(0.48, 0.12, 1.0), uBarPhase);
    col += flashCol * (barFlash + beatFlash);

    // === VIGNETTE ===
    vec2 vign = (vUV - 0.5) * 2.0;
    col *= 1.0 - dot(vign, vign) * 0.28;

    fragColor = vec4(col, 1.0);
}
