#version 460 core
// COMPOSITE — Holy Shit Lens FX + Scene Transitions + Full PostFX Pipeline
// Transitions: 0=Flash, 1=Swirl, 2=Shatter, 3=BloomBleed, 4=RadialZoom, 5=Implosion, 6=Supernova, 7=Crossfade

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;         // aktuelle Szene (HDR)
uniform sampler2D uBloom;         // Bloom-Chain
uniform sampler2D uNextScene;     // nächste Szene (für Transitions)

uniform float uTime;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uChromaticStr;
uniform float uVignetteStr;
uniform float uGrainStr;
uniform float uBeatStrength;
uniform float uHolyShitPhase;    // 0..1 — Klimax dieser Szene
uniform float uTransitionBlend;  // 0=aktuelle Szene, 1=nächste Szene
uniform int   uTransitionType;   // Transition-Art (0-7)

// ============================================================
// TRANSITION EFFECTS
// ============================================================

// Typ 0: Flash Cut — Fade durch Weiß
vec3 transFlash(vec2 uv, float t) {
    vec3 curr = texture(uScene,     uv).rgb;
    vec3 next = texture(uNextScene, uv).rgb;
    // Mitte = weiß, dann nächste Szene
    float mid  = smoothstep(0.0, 0.45, t);
    float end  = smoothstep(0.45, 1.0, t);
    vec3  white = vec3(3.0);
    return mix(mix(curr, white, mid), mix(white, next, end), end);
}

// Typ 1: Swirl Dissolve — Drehverzerrung
vec3 transSwirl(vec2 uv, float t) {
    vec2  c   = uv - 0.5;
    float r   = length(c);
    float ang = atan(c.y, c.x) + t * 5.0 * (1.0 - r);
    vec2  swUV = vec2(cos(ang), sin(ang)) * r + 0.5;
    swUV = mix(uv, swUV, t);
    swUV = clamp(swUV, 0.0, 1.0);
    vec3 curr = texture(uScene,     mix(uv, swUV, t * 0.8)).rgb;
    vec3 next = texture(uNextScene, mix(uv, swUV, (1.0-t)*0.8)).rgb;
    return mix(curr, next, smoothstep(0.3, 0.7, t));
}

// Typ 2: Shatter Dissolve — Pixel-Displacement nach außen
vec3 transShatter(vec2 uv, float t) {
    // Jede Zelle explodiert nach außen
    vec2  cell = floor(uv * 24.0);
    float cHash = hash12(cell);
    vec2  dir   = normalize(hash22(cell) * 2.0 - 1.0);
    vec2  offset = dir * t * t * 0.15 * cHash;
    vec2  currUV = clamp(uv + offset * (1.0 - t), 0.0, 1.0);
    vec2  nextUV = clamp(uv - offset * t, 0.0, 1.0);
    vec3  curr   = texture(uScene,     currUV).rgb;
    vec3  next   = texture(uNextScene, nextUV).rgb;
    float mask   = step(cHash, t * 1.2);
    return mix(curr * (1.0 - mask * 0.8), next, smoothstep(0.3, 0.8, t + cHash * 0.3));
}

// Typ 3: Bloom Bleed — helle Bereiche bluten durch
vec3 transBloomBleed(vec2 uv, float t) {
    vec3  curr    = texture(uScene,     uv).rgb;
    vec3  next    = texture(uNextScene, uv).rgb;
    vec3  bloom   = texture(uBloom,     uv).rgb;
    float bright  = dot(curr, vec3(0.299, 0.587, 0.114));
    float bleedMask = smoothstep(0.3, 0.7, bright + t * 0.8);
    return mix(curr, next, bleedMask * smoothstep(0.0, 1.0, t));
}

// Typ 4: Radial Zoom Dissolve — Einzoomen während Auflösung
vec3 transRadialZoom(vec2 uv, float t) {
    vec2 c = uv - 0.5;
    // Aktuelle Szene: zoomt heraus
    float zoomOut  = 1.0 + t * 0.25;
    vec2  currUV   = clamp(c / zoomOut + 0.5, 0.0, 1.0);
    // Nächste Szene: taucht herein
    float zoomIn   = mix(1.4, 1.0, t);
    vec2  nextUV   = clamp(c / zoomIn + 0.5, 0.0, 1.0);
    vec3  curr     = texture(uScene,     currUV).rgb * (1.0 - t * 0.5);
    vec3  next     = texture(uNextScene, nextUV).rgb;
    return mix(curr, next, smoothstep(0.25, 0.85, t));
}

// Typ 5: Implosion — alles kollabiert zum Zentrum
vec3 transImplosion(vec2 uv, float t) {
    vec2  c     = uv - 0.5;
    float r     = length(c);
    float pullT  = t * t;
    vec2  currUV = clamp(c * (1.0 - pullT * 0.6) + 0.5, 0.0, 1.0);
    vec3  curr   = texture(uScene,     currUV).rgb;
    vec3  next   = texture(uNextScene, uv).rgb;
    // Heller Blitz im Zentrum bei t=0.5
    float flash  = exp(-r * 20.0) * sin(t * 3.14159) * 3.0;
    return mix(curr, next, smoothstep(0.45, 0.85, t)) + vec3(flash);
}

// Typ 6: Supernova Flash — weißer Überstrahler
vec3 transSupernova(vec2 uv, float t) {
    vec3  curr   = texture(uScene,     uv).rgb;
    vec3  next   = texture(uNextScene, uv).rgb;
    // Schnell weiß → dann nächste Szene
    float white  = smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(0.35, 1.0, t));
    float blend  = smoothstep(0.35, 0.95, t);
    return mix(curr, next, blend) + vec3(white * 8.0);
}

// Typ 7: Standard Crossfade
vec3 transCrossfade(vec2 uv, float t) {
    vec3 curr = texture(uScene,     uv).rgb;
    vec3 next = texture(uNextScene, uv).rgb;
    return mix(curr, next, smoothstep(0.1, 0.9, t));
}

// ============================================================
// HOLY SHIT LENS EFFEKTE
// ============================================================

// Radiale Linsen-Verzerrung (Barrel bei Holy Shit)
vec2 holyShitDistort(vec2 uv, float phase) {
    vec2 c  = uv - 0.5;
    float r2 = dot(c, c);
    // Puls: Barrel → Pincushion → Barrel
    float warp = phase * 0.4 * sin(phase * 3.14159);
    c *= 1.0 + r2 * warp;
    return c + 0.5;
}

// Lens Flares — Sternförmig vom Zentrum
float lensFlare(vec2 uv, float phase) {
    vec2 c   = uv - 0.5;
    float r  = length(c);
    float ang = atan(c.y, c.x);

    // 6 Arme
    float arms = pow(abs(sin(ang * 6.0 + uTime * 2.0)) * 0.5 + 0.5, 8.0);
    float streak = exp(-r * 12.0) * arms;
    // Halo-Ring
    float halo = exp(-abs(r - 0.15) * 40.0) * 0.3;
    // Sekundär-Reflexe
    float ghost1 = exp(-length(uv - vec2(0.5 + 0.2, 0.5)) * 20.0) * 0.2;
    float ghost2 = exp(-length(uv - vec2(0.5 - 0.35, 0.5 - 0.1)) * 25.0) * 0.15;

    return (streak + halo + ghost1 + ghost2) * phase * phase;
}

// Chromatische Explosion — radialer Aberrations-Burst
vec3 holyChromaticBurst(vec2 uv, float phase) {
    vec2  c       = uv - 0.5;
    float r       = length(c);
    float burstStr = phase * 0.04 * (1.0 + r * 2.0);
    vec2  offset  = normalize(c + 0.001) * burstStr;

    float rC = texture(uScene, clamp(uv + offset * 1.5, 0.0, 1.0)).r;
    float gC = texture(uScene, uv).g;
    float bC = texture(uScene, clamp(uv - offset * 1.0, 0.0, 1.0)).b;
    return vec3(rC, gC, bC);
}

// ============================================================
// MAIN
// ============================================================

void main() {
    vec2 uv = vUV;

    // -------- Transition Blend --------
    vec3 col;
    if (uTransitionBlend > 0.001) {
        float t = uTransitionBlend;
        if      (uTransitionType == 0) col = transFlash      (uv, t);
        else if (uTransitionType == 1) col = transSwirl      (uv, t);
        else if (uTransitionType == 2) col = transShatter    (uv, t);
        else if (uTransitionType == 3) col = transBloomBleed (uv, t);
        else if (uTransitionType == 4) col = transRadialZoom (uv, t);
        else if (uTransitionType == 5) col = transImplosion  (uv, t);
        else if (uTransitionType == 6) col = transSupernova  (uv, t);
        else                           col = transCrossfade  (uv, t);
    } else {
        // -------- Normal Frame --------

        // Holy-Shit Linsen-Verzerrung
        if (uHolyShitPhase > 0.001) {
            uv = holyShitDistort(uv, uHolyShitPhase);
            uv = clamp(uv, 0.0, 1.0);
        }

        // Chromatische Aberration (normal + holy shit burst)
        vec2 ca = (uv - 0.5) * uChromaticStr;
        if (uHolyShitPhase > 0.001) {
            col = holyChromaticBurst(uv, uHolyShitPhase);
        } else {
            col.r = texture(uScene, uv + ca).r;
            col.g = texture(uScene, uv).g;
            col.b = texture(uScene, uv - ca).b;
        }

        // Bloom
        vec3 bloom = texture(uBloom, uv).rgb
                   * (uBloomStrength + uBeatStrength * 0.6 + uHolyShitPhase * 2.0);
        col += bloom;

        // Lens Flares bei Holy Shit
        if (uHolyShitPhase > 0.05) {
            float flare = lensFlare(uv, uHolyShitPhase);
            vec3 flareColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.8, 0.5), uHolyShitPhase);
            col += flareColor * flare * 2.5;
        }

        // White Flash bei Holy-Shit Onset (wenn es stark einsetzt)
        float holyFlash = pow(uHolyShitPhase, 3.0) * 0.0; // subtil, wird durch Bloom dominiert
        col += holyFlash;
    }

    // -------- Exposure --------
    float exposureBoost = uExposure + uHolyShitPhase * 0.35;
    col *= exposureBoost;

    // -------- ACES Tonemap --------
    col = tonemapACES(col);

    // -------- Gamma --------
    col = linearToSRGB(col);

    // -------- Film Grain --------
    float grainAmt = uGrainStr * mix(1.0, 0.4, uHolyShitPhase); // weniger Korn bei Holy Shit
    float grain = hash12(uv + vec2(uTime * 0.03781, uTime * 0.02974)) - 0.5;
    col += grain * grainAmt;

    // -------- Vignette --------
    vec2  vig  = (uv - 0.5) * 2.0;
    float vignBase = dot(vig, vig) * uVignetteStr;
    // Holy Shit: Vignette invertiert sich (Ränder leuchten!)
    float vignHS   = dot(vig, vig) * uHolyShitPhase * 0.5;
    float vign     = 1.0 - vignBase + vignHS;
    col *= clamp(vign, 0.0, 1.3);

    // -------- Lens Dirt (Beat-Highlights) --------
    float beatDirt = pow(uBeatStrength, 3.0) * 0.18;
    float dirtPat  = fbm2(vUV * 3.0 + 0.7, 3, 2.0, 0.5);
    float sceneLum = dot(texture(uScene, vUV).rgb, vec3(0.299, 0.587, 0.114));
    col += vec3(0.9, 0.8, 0.6) * dirtPat * beatDirt * sceneLum;

    fragColor = vec4(clamp(col, 0.0, 1.5), 1.0);
}
