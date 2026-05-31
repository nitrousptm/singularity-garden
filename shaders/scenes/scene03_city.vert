#version 460 core
// SCENE 3: CITY — Vertex Shader
// 4 Architektur-Typen mit Setbacks, korrekte Normalmatrix, BPM-Deformation

#include "../common/noise.glsl"

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aTangent;

layout(location = 4) in vec4 aInstPos;   // xyz=world base pos, w=height
layout(location = 5) in vec4 aInstData;  // x=width, y=depth, z=seed, w=buildingType(0-3)

out vec3  vWorldPos;
out vec3  vNormal;
out vec2  vUV;
out float vCorruption;
out float vSeed;
out float vHeight;
out float vBuildingType;
out float vNormalizedY;

uniform mat4  uView;
uniform mat4  uProj;
uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;

void main() {
    float seed  = aInstData.z;
    float btype = aInstData.w;
    float h     = aInstPos.w;
    float w     = aInstData.x;
    float d     = aInstData.y;

    // aPos ∈ [-0.5, 0.5]^3
    float normalizedY = aPos.y + 0.5;  // 0=Boden, 1=Dach
    vNormalizedY  = normalizedY;
    vSeed         = seed;
    vHeight       = h;
    vBuildingType = btype;

    // Skalierung der lokalen Vertices
    vec3 localPos = aPos * vec3(w, h, d);

    // ======= PER-TYP ARCHITEKTURFORMEN =======

    if (btype < 0.5) {
        // TYPE 0: BRUTALIST — 2 Setbacks + Attika-Mauer
        float shrink1 = smoothstep(0.57, 0.63, normalizedY) * 0.30;
        float shrink2 = smoothstep(0.80, 0.86, normalizedY) * 0.22;
        localPos.xz *= (1.0 - shrink1 - shrink2);

        // Horizontale Fassadenrippen (Bautiefe-Vor- und Rücksprung)
        float ribMask = abs(fract(normalizedY * h * 0.5) * 2.0 - 1.0);
        float ribDepth = smoothstep(0.88, 1.0, ribMask) * 0.04;
        localPos += aNormal * ribDepth * (1.0 - abs(aNormal.y));
    }
    else if (btype < 1.5) {
        // TYPE 1: GLAS-TURM — leichte Verjüngung, saubere Kanten
        float taper = 1.0 - normalizedY * 0.07;
        localPos.xz *= taper;
    }
    else if (btype < 2.5) {
        // TYPE 2: INDUSTRIAL — Stahlrippen auf Fassade (Finnen)
        // Nur auf Seiten-Flächen, nicht auf Dach/Boden
        float isSide = 1.0 - abs(aNormal.y);
        float bandFreq = h * 0.55;
        float band = sin(normalizedY * bandFreq * 3.14159) * 0.5 + 0.5;
        float fin  = pow(band, 6.0) * 0.12 * isSide;
        localPos  += aNormal * fin;
    }
    else {
        // TYPE 3: MIXED — breiter Sockel + schlanker Turm
        float isPodium = 1.0 - smoothstep(0.27, 0.33, normalizedY);
        // Sockel ist ~2x breiter
        float baseScale  = mix(0.72, 2.0, isPodium);
        // Turm verjüngt sich leicht nach oben
        float towerTaper = 1.0 - normalizedY * 0.06 * (1.0 - isPodium);
        localPos.xz *= mix(towerTaper, baseScale, isPodium);
    }

    // ======= KORRUPTIONS-DEFORMATION =======
    float corrupt = uProgress;
    vCorruption = corrupt;

    // Fraktales Wachstum (wirkt stärker oben)
    float corruptNoise = fbm3(
        (aInstPos.xyz + localPos) * 0.16 + seed + uTime * 0.07,
        5, 2.0, 0.55
    );
    float growth = pow(corruptNoise, 2.2) * corrupt * 2.8 * normalizedY;
    localPos += aNormal * (1.0 - abs(aNormal.y)) * growth * 0.10;

    // Typ-spezifische Korruption
    if (btype < 0.5) {
        // Brutalist: Verdrehung
        float twistAng = corrupt * 0.55 * normalizedY
                       * sin(seed * 13.7 + uTime * 0.16);
        float c = cos(twistAng), s = sin(twistAng);
        vec2 twisted = vec2(localPos.x * c - localPos.z * s,
                            localPos.x * s + localPos.z * c);
        localPos.xz = mix(localPos.xz, twisted, normalizedY * corrupt);
    }
    else if (btype < 1.5) {
        // Glas: Wellen-Korruption
        float wave = sin(normalizedY * 22.0 + uTime * 4.0) * 0.018 * corrupt;
        localPos   += aNormal * wave;
    }
    else if (btype < 2.5) {
        // Industrial: Platten lösen sich
        float panelRow  = floor(normalizedY * h * 0.45);
        float panelSep  = sin(panelRow * 47.3 + uTime * 0.35) * 0.035 * corrupt;
        localPos       += aNormal * panelSep * (1.0 - abs(aNormal.y));
    }
    else {
        // Mixed: Sockel wölbt sich nach außen
        float bulge = smoothstep(0.26, 0.30, normalizedY)
                    * sin(seed * 7.1 + uTime * 0.22) * 0.09 * corrupt;
        localPos.xz += normalize(localPos.xz + 0.001) * bulge;
    }

    // BPM-Puls: kurzes Vibrieren bei Beat
    float beatPulse = pow(max(0.0, 1.0 - uBeatPhase * 5.0), 3.0) * uBeatStrength;
    localPos += aNormal * sin(seed * 47.3 + uTime * 10.0) * 0.015
              * corrupt * beatPulse * normalizedY;

    // ======= KORREKTE NORMALMATRIX =======
    // scale = vec3(w, h, d) → Inverse-Transpose = 1/scale per Komponente, dann normiert
    vec3 scaledN = aNormal / vec3(w, h, d);
    vNormal = normalize(scaledN);

    vec3 worldPos = aInstPos.xyz + localPos;
    vWorldPos = worldPos;
    vUV       = aUV;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
