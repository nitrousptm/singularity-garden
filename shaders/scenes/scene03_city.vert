#version 460 core
// SCENE 3: NIGHT CITY — Vertex Shader
// 6 Architektur-Typen: Brutalist, Glas, Industrial, Mixed, Billboard, Megastruktur

#include "../common/noise.glsl"

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aTangent;

layout(location = 4) in vec4 aInstPos;   // xyz=world base pos, w=height
layout(location = 5) in vec4 aInstData;  // x=width, y=depth, z=seed, w=buildingType(0-5)

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

    float normalizedY = aPos.y + 0.5;
    vNormalizedY  = normalizedY;
    vSeed         = seed;
    vHeight       = h;
    vBuildingType = btype;

    vec3 localPos = aPos * vec3(w, h, d);

    // ======= PER-TYP ARCHITEKTURFORMEN =======

    if (btype < 0.5) {
        // TYPE 0: BRUTALIST — Setbacks + Attika + horizontale Rippen
        float shrink1 = smoothstep(0.52, 0.58, normalizedY) * 0.28;
        float shrink2 = smoothstep(0.76, 0.82, normalizedY) * 0.20;
        float shrink3 = smoothstep(0.90, 0.95, normalizedY) * 0.15;
        localPos.xz *= (1.0 - shrink1 - shrink2 - shrink3);

        // Tiefe horizontale Fassadenrippen (Parkdecks / Technikgeschosse)
        float ribFreq = h * 0.45;
        float ribMask = abs(fract(normalizedY * ribFreq) * 2.0 - 1.0);
        float ribDepth = smoothstep(0.80, 1.0, ribMask) * 0.06;
        localPos += aNormal * ribDepth * (1.0 - abs(aNormal.y));

        // Schwere vertikale Pfeiler (nur an Ecken, via UV)
        float pfeil = smoothstep(0.42, 0.50, abs(aUV.x - 0.5) * 2.0) * 0.045
                    * (1.0 - abs(aNormal.y)) * (1.0 - abs(aNormal.y));
        localPos += aNormal * pfeil;
    }
    else if (btype < 1.5) {
        // TYPE 1: GLAS-TURM — leichte Verjüngung + diagonale Fase oben
        float taper = 1.0 - normalizedY * 0.10;
        localPos.xz *= taper;

        // Dach: abgeschrägte Spitze (Diamond Cut)
        float cutStart = 0.88;
        float cutAmt   = max(0.0, normalizedY - cutStart) / (1.0 - cutStart);
        float cutShape = abs(aUV.x - 0.5) + abs(aUV.y - 0.5);
        localPos.y    -= max(0.0, cutShape - 0.3) * cutAmt * h * 0.25;
    }
    else if (btype < 2.5) {
        // TYPE 2: INDUSTRIAL — Stahlrippen + Antennen-Cluster oben
        float isSide = 1.0 - abs(aNormal.y);
        float bandFreq = h * 0.60;
        float band = sin(normalizedY * bandFreq * 3.14159) * 0.5 + 0.5;
        float fin  = pow(band, 5.0) * 0.10 * isSide;
        localPos  += aNormal * fin;

        // Dach: unebene Aufbauten (Kühltürme etc. via noise)
        float roofBump = step(0.92, normalizedY)
                       * vnoise3(vec3(aPos.x * 4.0 + seed, 0.0, aPos.z * 4.0 + seed)) * 0.5 * h * 0.08;
        localPos.y += roofBump;
    }
    else if (btype < 3.5) {
        // TYPE 3: MIXED — breiter Sockel + schlanker Turm
        float isPodium = 1.0 - smoothstep(0.24, 0.30, normalizedY);
        float baseScale  = mix(0.68, 2.2, isPodium);
        float towerTaper = 1.0 - normalizedY * 0.08 * (1.0 - isPodium);
        localPos.xz *= mix(towerTaper, baseScale, isPodium);

        // Sockel: abgestufte Terrassen
        float terrace = smoothstep(0.18, 0.22, normalizedY) * 0.18 * isPodium;
        localPos.xz  -= normalize(localPos.xz + 0.001) * terrace;
    }
    else if (btype < 4.5) {
        // TYPE 4: BILLBOARD PILLAR — glatte Fassadenflächen für Holoads
        // Nur minimale Geometrie: scharfe Kanten, flache Wände
        float taper = 1.0 - normalizedY * 0.04;
        localPos.xz *= taper;

        // Leichte Wölbung der Hauptfassade (konvex für Hologramm)
        float isFront = max(0.0, aNormal.z);   // nur Vorderseite
        float isBack  = max(0.0, -aNormal.z);
        float bulge   = 0.025 * (4.0 * aUV.x * (1.0 - aUV.x)) * (1.0 - abs(normalizedY - 0.5) * 2.0);
        localPos += aNormal * bulge * (isFront + isBack) * (1.0 - abs(aNormal.y));
    }
    else {
        // TYPE 5: MEGASTRUKTUR — massive gestaffelte Terrassen + Vertikal-Schächte
        // Gestaffelte Setbacks (5 Stufen)
        float s1 = smoothstep(0.20, 0.24, normalizedY) * 0.18;
        float s2 = smoothstep(0.38, 0.42, normalizedY) * 0.14;
        float s3 = smoothstep(0.55, 0.59, normalizedY) * 0.12;
        float s4 = smoothstep(0.72, 0.76, normalizedY) * 0.10;
        float s5 = smoothstep(0.86, 0.90, normalizedY) * 0.08;
        localPos.xz *= (1.0 - s1 - s2 - s3 - s4 - s5);

        // Tiefe vertikale Schächte / Kanäle auf Fassade
        float channelU = fract(aUV.x * 5.0 + seed);
        float channel  = step(0.85, channelU) * 0.08 * (1.0 - abs(aNormal.y));
        localPos      -= aNormal * channel;

        // Massive horizontale Technikbänder (Versorgungsebenen)
        float techBand = step(0.0, sin(normalizedY * h * 0.3)) * 0.04;
        techBand      *= smoothstep(0.0, 0.08, abs(fract(normalizedY * h * 0.3 / 3.14159) - 0.5) - 0.3);
        localPos      += aNormal * techBand * (1.0 - abs(aNormal.y));
    }

    // ======= KORRUPTIONS-DEFORMATION =======
    float corrupt = uProgress;
    vCorruption = corrupt;

    float corruptNoise = fbm3(
        (aInstPos.xyz + localPos) * 0.14 + seed + uTime * 0.06,
        5, 2.0, 0.55
    );
    float growth = pow(corruptNoise, 2.0) * corrupt * 3.2 * normalizedY;
    localPos += aNormal * (1.0 - abs(aNormal.y)) * growth * 0.10;

    if (btype < 0.5) {
        float twistAng = corrupt * 0.65 * normalizedY * sin(seed * 13.7 + uTime * 0.16);
        float c = cos(twistAng), s = sin(twistAng);
        vec2 twisted = vec2(localPos.x * c - localPos.z * s,
                            localPos.x * s + localPos.z * c);
        localPos.xz = mix(localPos.xz, twisted, normalizedY * corrupt);
    }
    else if (btype < 1.5) {
        float wave = sin(normalizedY * 24.0 + uTime * 4.5) * 0.016 * corrupt;
        localPos  += aNormal * wave;
    }
    else if (btype < 2.5) {
        float panelRow = floor(normalizedY * h * 0.45);
        float panelSep = sin(panelRow * 47.3 + uTime * 0.35) * 0.04 * corrupt;
        localPos      += aNormal * panelSep * (1.0 - abs(aNormal.y));
    }
    else if (btype < 3.5) {
        float bulge = smoothstep(0.26, 0.30, normalizedY) * sin(seed * 7.1 + uTime * 0.22) * 0.10 * corrupt;
        localPos.xz += normalize(localPos.xz + 0.001) * bulge;
    }
    else if (btype < 4.5) {
        // Billboard: Hologramm-Wellen-Korruption
        float hwave = sin(normalizedY * 18.0 + uTime * 6.0) * 0.022 * corrupt;
        float vwave = sin(aUV.x * 12.0 + uTime * 4.0) * 0.018 * corrupt;
        localPos += aNormal * (hwave + vwave);
    }
    else {
        // Megastruktur: blockweise seismische Verschiebung
        float blockY  = floor(normalizedY * 5.0);
        float blockShift = sin(blockY * 37.1 + seed * 7.3 + uTime * 0.12) * 0.06 * corrupt;
        localPos.xz  += normalize(localPos.xz + 0.001) * blockShift;
    }

    // BPM-Puls
    float beatPulse = pow(max(0.0, 1.0 - uBeatPhase * 5.0), 3.0) * uBeatStrength;
    localPos += aNormal * sin(seed * 47.3 + uTime * 10.0) * 0.014
              * corrupt * beatPulse * normalizedY;

    // Normale korrekt skalieren
    vec3 scaledN = aNormal / vec3(w, h, d);
    vNormal = normalize(scaledN);

    vec3 worldPos = aInstPos.xyz + localPos;
    vWorldPos = worldPos;
    vUV       = aUV;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
