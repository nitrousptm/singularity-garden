#version 460 core
// SCENE 1: BOOT — CRT Startup (0:00-0:20, 133 BPM)
// 4 Phasen: POWER_ON → HEX_MATERIALIZE → DATA_CASCADE → SYSTEM_ONLINE
// Flickern durch BPM-gesteuerte Glitches ersetzt, kein rohes Hochfrequenzflimmern

#include "../common/noise.glsl"
#include "../common/sdf.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform float uHolyShitPhase;
uniform int   uBeat;
uniform vec2  uResolution;

#define PHASE_POWER  0.14
#define PHASE_HEX    0.38
#define PHASE_DATA   0.68

// -------- CRT barrel distortion --------
vec2 crtDistort(vec2 uv, float strength) {
    uv = uv * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    uv *= 1.0 + r2 * (strength + r2 * strength * 0.18);
    return uv * 0.5 + 0.5;
}

// -------- Sharper scanline + phosphor grid --------
float scanline(vec2 uv, float intensity) {
    float sl = sin(uv.y * uResolution.y * 1.5707963) * 0.5 + 0.5;
    float ph = sin(uv.x * uResolution.x * 1.5707963) * 0.5 + 0.5;
    return mix(1.0, sl * (0.75 + ph * 0.25), intensity);
}

// -------- Boot scanline sweep (top → bottom) --------
float bootSweep(vec2 uv, float t) {
    float sweepY = smoothstep(0.0, 0.6, t) * 1.1 - 0.05;
    float beam  = exp(-abs(uv.y - sweepY) * 120.0);
    float trail = smoothstep(sweepY - 0.08, sweepY, uv.y) * 0.2 * smoothstep(sweepY, sweepY - 0.25, uv.y);
    return beam + trail;
}

// -------- BPM-gesteuerte Glitch-Displacement (kein Flimmern!) --------
vec2 bpmGlitch(vec2 uv, float beatPhase, float prog) {
    // Nur bei Beat-Onset (erste 25% des Beats), danach sofort abklingend
    float onset = pow(max(0.0, 1.0 - beatPhase * 4.0), 2.5);
    // Je weiter die Szene voranschreitet, desto weniger Glitch
    float power = onset * 0.018 * mix(1.0, 0.15, smoothstep(0.35, 0.85, prog));

    float row     = floor(uv.y * 20.0);
    float rowHash = hash11(row * 0.453 + float(uBeat) * 0.137);
    float glitchRow = step(0.82, rowHash); // nur ~18% der Zeilen gleiten
    float dir = sign(rowHash - 0.91);

    return vec2(uv.x + power * glitchRow * dir, uv.y);
}

// -------- Hex-Grid mit Aktivierungswelle vom Zentrum --------
float hexActivated(vec2 uv, float cellSize, float wave) {
    float dist = length(uv - 0.5);
    float activation = smoothstep(wave - 0.06, wave + 0.18, 0.85 - dist);
    return hexGrid(uv, cellSize) * activation;
}

// -------- BPM-Ripple vom Zentrum auf Hex-Grid --------
float beatRipple(vec2 uv, float beatPhase, float beatStrength) {
    float dist  = length(uv - 0.5);
    float front = beatPhase * 0.75; // expandierender Ring
    float ring  = exp(-abs(dist - front) * 30.0) * (1.0 - beatPhase) * beatStrength;
    return ring;
}

// -------- Elektrische Bögen entlang Hex-Kanten --------
float electricArc(vec2 uv, float t, float seed) {
    float col = floor(uv.x * 28.0 + seed * 7.3);
    float row = floor(uv.y * 16.0 + seed * 3.1);
    float cellHash = hash11(col * 0.3713 + row * 0.1879 + seed);

    // Aktivierung wechselt mit Zeit (nicht jeder Frame)
    float isActive = step(0.72, fract(cellHash + floor(t * 3.0) * 0.073));

    float lx = fract(uv.x * 28.0 + seed * 7.3);
    float ly = fract(uv.y * 16.0 + seed * 3.1);

    // Horizontaler Bogen mit Noise-Wellung
    float noise = sin(lx * 60.0 + t * 25.0 + cellHash * 6.28) * 0.12;
    float arcH = exp(-abs(ly - 0.5 + noise) * 18.0);
    arcH *= step(0.06, lx) * step(lx, 0.94);

    return isActive * arcH;
}

// -------- Datenströme mit Beat-Reaktion --------
float dataStream(vec2 uv, float t, float beatBoost, float seed) {
    float col   = floor(uv.x * 50.0 + seed);
    float speed = hash11(col * 0.137 + seed) * 9.0 + 4.0;
    float offset = hash11(col * 0.3719 + seed) * 25.0;
    speed *= 1.0 + beatBoost * 2.5 * hash11(col * 0.571 + seed);

    float y = fract(uv.y - t * speed * 0.10 + offset);
    float x = fract(uv.x * 50.0 + seed);
    float cell = col * 300.0 + floor(y * 80.0);
    float ch = step(0.38, hash11(cell + floor(t * 4.0) * 0.11));

    float outline = step(0.07, x) * step(x, 0.93) * step(0.04, y) * step(y, 0.96);
    float fade    = pow(1.0 - abs(y * 2.0 - 1.0), 1.8);

    // Spalten-Burst auf Beat
    float colBurst = smoothstep(0.0, 0.15, beatBoost) * hash11(col * 0.419 + floor(t) * 0.07);
    return (ch * outline * fade + colBurst * 0.25) * outline;
}

// -------- Rotierendes Kern-Mandala --------
float coreMandala(vec2 uv, float t, float progress) {
    vec2 c = uv - 0.5;
    float r   = length(c);
    float ang = atan(c.y, c.x);

    float segs = 6.0;
    float segStep = 3.14159265 * 2.0 / segs;

    float ring1 = smoothstep(0.006, 0.0, abs(r - 0.065));
    float ring2 = smoothstep(0.004, 0.0, abs(r - 0.115));
    float ring3 = smoothstep(0.005, 0.0, abs(r - 0.175));

    // Rotierende Speichen
    float spAngFwd = fract(ang / segStep + t * 0.18) * 2.0 - 1.0;
    float spAngBwd = fract(ang / segStep - t * 0.12) * 2.0 - 1.0;
    float spokeF   = smoothstep(0.12, 0.0, abs(spAngFwd) * r * 6.0);
    float spokeB   = smoothstep(0.12, 0.0, abs(spAngBwd) * r * 6.0);

    float shape = max(max(ring1, ring2), max(ring3, max(spokeF, spokeB)));
    return shape * smoothstep(0.28, 0.55, progress) * step(r, 0.22);
}

void main() {
    // Beat-Onset: 0→1 beim Beat, klingt rasch ab
    float beatPulse = pow(max(0.0, 1.0 - uBeatPhase * 2.8), 2.0) * uBeatStrength;
    float barPulse  = pow(max(0.0, 1.0 - uBarPhase  * 5.0), 3.0) * uBeatStrength;

    // CRT-Verzerrung nimmt mit Progress ab
    float crtStr = mix(0.048, 0.016, smoothstep(0.2, 0.75, uProgress));
    vec2 glitchUV = bpmGlitch(vUV, uBeatPhase, uProgress);
    vec2 uv = crtDistort(glitchUV, crtStr);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0);
        return;
    }

    float powerOn    = smoothstep(0.0,         PHASE_POWER, uProgress);
    float hexPhase   = smoothstep(PHASE_POWER,  PHASE_HEX,  uProgress);
    float dataPhase  = smoothstep(PHASE_HEX,    PHASE_DATA, uProgress);
    float online     = smoothstep(PHASE_DATA,   1.0,        uProgress);

    vec2  cUV = uv - 0.5;

    // === LAYER 1: VOID ===
    vec3 col = vec3(0.0, 0.008, 0.018) * powerOn;

    // === LAYER 2: BOOT-SWEEP ===
    float sweep = bootSweep(uv, uSceneTime * 2.8);
    col += vec3(0.0, 0.9, 0.5) * sweep * (1.0 - hexPhase);
    col += vec3(0.1, 0.55, 1.0) * sweep * hexPhase * 0.35;

    // === LAYER 3: HEX-GRID mit Aktivierungswelle ===
    float waveFront = smoothstep(PHASE_POWER, PHASE_HEX + 0.08, uProgress) * 0.82;
    float hex  = hexActivated(uv, 15.0, waveFront);
    float hex2 = hexActivated(uv, 5.5,  waveFront * 0.88);

    float hexBeat = 1.0 + beatPulse * 1.0;
    col += vec3(0.0, 0.75, 0.4)  * hex  * 0.65 * hexPhase * hexBeat;
    col += vec3(0.0, 0.28, 0.62) * hex2 * 0.55 * hexPhase * hexBeat;

    // Beat-Ripple vom Zentrum auf Hex
    float ripple = beatRipple(uv, uBeatPhase, uBeatStrength);
    col += vec3(0.0, 0.55, 0.9) * ripple * 0.5 * hexPhase;

    // === LAYER 4: ELEKTRISCHE BÖGEN ===
    float arc1 = electricArc(uv, uTime, 0.0);
    float arc2 = electricArc(uv, uTime, 5.3);
    float arcFade = hexPhase * (1.0 - online * 0.8);
    col += vec3(0.25, 0.85, 1.0) * (arc1 + arc2) * 0.9 * arcFade;

    // === LAYER 5: DATENSTRÖME ===
    float caStrength = mix(0.007, 0.001, smoothstep(PHASE_DATA, 1.0, uProgress));
    // Chromatische Aberration: 3 versetzte Streams
    float ds_r = dataStream(uv + vec2( caStrength, 0.0), uTime * 0.45, beatPulse, 0.0);
    float ds_g = dataStream(uv,                          uTime * 0.45, beatPulse, 0.0);
    float ds_b = dataStream(uv + vec2(-caStrength, 0.0), uTime * 0.45, beatPulse, 0.0);
    col += vec3(ds_r, ds_g, ds_b) * vec3(0.05, 0.95, 0.3) * 0.9 * dataPhase;

    // Zweiter Stream-Layer (anders farbig, langsamer)
    float ds2 = dataStream(uv * 0.65, uTime * 0.28 + 80.0, beatPulse * 0.5, 3.7);
    col += ds2 * vec3(0.0, 0.35, 0.85) * 0.45 * dataPhase;

    // === LAYER 6: KERN-MANDALA ===
    float mandala = coreMandala(uv, uTime, uProgress);
    float coreR = length(cUV);
    float coreGlow1 = exp(-coreR * 11.0) * smoothstep(0.22, 0.72, uProgress) * (0.5 + beatPulse * 0.5);
    float coreGlow2 = exp(-coreR * 4.5)  * online * 0.35;

    // Farbe des Mandala wechselt mit Bar-Phase (teal → blau → violett)
    vec3 mandalaCol = mix(
        mix(vec3(0.0, 0.85, 1.0), vec3(0.3, 0.3, 1.0), uBarPhase),
        vec3(0.6, 0.1, 1.0),
        online * 0.4
    );
    col += mandalaCol * mandala * 2.2;
    col += vec3(0.0, 0.72, 1.0) * coreGlow1;
    col += vec3(0.08, 0.35, 0.85) * coreGlow2;

    // === LAYER 7: BAR-FLASH (größere Beats) ===
    float barFlash  = barPulse  * 0.3  * online;
    float beatFlash = beatPulse * 0.15 * hexPhase;
    vec3 flashCol = mix(vec3(0.0, 0.5, 1.0), vec3(0.4, 0.1, 1.0), uBarPhase);
    col += flashCol * (barFlash + beatFlash);

    // === LAYER 8: SCANLINES + PHOSPHOR ===
    float slIntensity = mix(0.75, 0.3, smoothstep(PHASE_DATA, 1.0, uProgress));
    col *= scanline(uv, slIntensity);

    // === LAYER 9: CRT VIGNETTE ===
    float vign = dot(cUV * 1.55, cUV * 1.55);
    col *= clamp(1.0 - vign * vign, 0.0, 1.0);

    // === LAYER 10: FILMKORN (nimmt mit Progress ab) ===
    float grain = hash12(uv + vec2(uTime * 0.041, uTime * 0.083)) - 0.5;
    col += grain * mix(0.055, 0.012, smoothstep(0.3, 0.85, uProgress)) * powerOn;

    // === PHOSPHOR FARBTÖNUNG (Cyan-Grün → Weiß) ===
    vec3 tint = mix(vec3(0.85, 1.0, 0.90), vec3(0.95, 0.98, 1.0), online);
    col = mix(col, col * tint, 0.28 * powerOn);

    // === HOLY SHIT MOMENT: SYSTEM ONLINE EXPLOSION ===
    // Alle Elemente aktivieren sich gleichzeitig — totale Sättigung
    if (uHolyShitPhase > 0.001) {
        float hs = uHolyShitPhase;

        // Alle Hex-Zellen leuchten gleichzeitig auf
        float allHex = (hexGrid(uv, 15.0) + hexGrid(uv, 5.5)) * hs * 3.0;
        col += vec3(0.0, 0.8, 1.0) * allHex;

        // Mandala explodiert (alle Ringe gleichzeitig + maximale Helligkeit)
        float hsCore = exp(-length(cUV) * (8.0 - hs * 6.0)) * hs * 2.0;
        col += mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 1.0, 1.0), hs) * hsCore;

        // Weißer Strahl-Burst (wie CRT-Röhre die sich einschaltet)
        float beam1 = exp(-abs(cUV.y) * (80.0 - hs * 75.0)) * hs * 0.8;
        float beam2 = exp(-abs(cUV.x) * (80.0 - hs * 75.0)) * hs * 0.8;
        col += vec3(0.5, 0.9, 1.0) * (beam1 + beam2);

        // Alle Scanlines verschwinden (kristallklares Bild)
        col = mix(col, col * 1.0 / scanline(uv, slIntensity), hs * 0.7);

        // Farbe wechselt zu Reinweiß-Cyan
        col = mix(col, col * vec3(0.85, 1.0, 1.0) * (1.0 + hs), hs * 0.4);
    }

    fragColor = vec4(col, 1.0);
}
