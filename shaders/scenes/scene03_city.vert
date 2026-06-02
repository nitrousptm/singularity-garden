#version 460 core
// SCENE 3: NIGHT CITY — Vertex Shader
// btype = archStyle + part*6
//   archStyle = mod(btype,6): 0=Brutalist 1=Glas 2=Industrial 3=Mixed 4=Billboard 5=Mega
//   part      = floor(btype/6): 0=Turm 1=Sockel 2=Spitze 3=Flügel

#include "../common/noise.glsl"

layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aTangent;

layout(location = 4) in vec4 aInstPos;   // xyz=world center, w=height
layout(location = 5) in vec4 aInstData;  // x=width, y=depth, z=seed, w=btype

out vec3  vWorldPos;
out vec3  vNormal;
out vec2  vUV;
out float vBuildingType;   // volle btype für Fragment-Shader
out float vArchStyle;      // mod(btype,6)
out float vPart;           // floor(btype/6)
out float vSeed;
out float vHeight;
out float vNormalizedY;    // 0=Boden 1=Dach

uniform mat4  uView;
uniform mat4  uProj;
uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;

// Hilfsfunktion: Abstand von UV-Punkt zur nächsten Kante
float uvEdgeDist(vec2 uv) {
    return min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
}

void main() {
    float seed  = aInstData.z;
    float btype = aInstData.w;
    float h     = aInstPos.w;
    float w     = aInstData.x;
    float d     = aInstData.y;

    float archStyle  = mod(btype, 6.0);
    float part       = floor(btype / 6.0);
    float normalizedY = aPos.y + 0.5;   // 0=Boden 1=Dach

    vNormalizedY  = normalizedY;
    vSeed         = seed;
    vHeight       = h;
    vBuildingType = btype;
    vArchStyle    = archStyle;
    vPart         = part;

    vec3 localPos = aPos * vec3(w, h, d);

    // ======= HAUPTTURM (part == 0) =======
    if (part < 0.5) {

        if (archStyle < 0.5) {
            // BRUTALIST: 3 markante Setbacks + tiefe horizontale Rippen
            float s1 = smoothstep(0.50, 0.56, normalizedY) * 0.28;
            float s2 = smoothstep(0.72, 0.78, normalizedY) * 0.20;
            float s3 = smoothstep(0.88, 0.93, normalizedY) * 0.14;
            localPos.xz *= (1.0 - s1 - s2 - s3);

            // Tiefe Fassadenrippen (Deckenplatten sichtbar)
            float rf = h * 0.48;
            float rMask = abs(fract(normalizedY * rf) * 2.0 - 1.0);
            float rDepth = smoothstep(0.82, 1.0, rMask) * 0.07;
            localPos += aNormal * rDepth * (1.0 - abs(aNormal.y));

            // Eckpfeiler (via UV)
            float pfeil = smoothstep(0.42, 0.50, abs(aUV.x - 0.5)*2.0) * 0.04
                        * (1.0 - abs(aNormal.y));
            localPos += aNormal * pfeil;

            // Abgechamferte Ecken (ergibt Oktogon-Anmutung)
            float chamfer = max(0.0, abs(localPos.x/w) + abs(localPos.z/d) - 1.0);
            localPos.xz  -= normalize(localPos.xz + 0.001) * chamfer * 0.08;
        }

        else if (archStyle < 1.5) {
            // GLAS-TURM: Elegante Verjüngung + Architektonische Drehung + Diamant-Spitze
            float taper = 1.0 - normalizedY * 0.12;
            localPos.xz *= taper;

            // Leichte architektonische Drehung (kein Korruptionseffekt, reines Design)
            float twistDeg = hash11(seed * 2.1) > 0.5 ? 0.18 : 0.0;  // nur 50% Gebäude
            float twistAng = twistDeg * normalizedY;
            float tc = cos(twistAng), ts = sin(twistAng);
            vec2  twisted = vec2(localPos.x*tc - localPos.z*ts,
                                 localPos.x*ts + localPos.z*tc);
            localPos.xz = twisted;

            // Diamant-Dachabschluss
            float cutS = 0.86;
            float cutA = max(0.0, normalizedY - cutS) / (1.0 - cutS);
            float cSh  = abs(aUV.x - 0.5) + abs(aUV.y - 0.5);
            localPos.y -= max(0.0, cSh - 0.28) * cutA * h * 0.20;

            // Fassadenvertiefungen (horizontale Trennfugen)
            float band = fract(normalizedY * h * 0.38);
            float groove = smoothstep(0.0, 0.04, band) * (1.0 - smoothstep(0.96, 1.0, band));
            localPos += aNormal * (1.0 - groove) * 0.012 * (1.0 - abs(aNormal.y));
        }

        else if (archStyle < 2.5) {
            // INDUSTRIAL: Strukturbänder + Dach-Aufbauten + Versteifungsrippen
            float isSide = 1.0 - abs(aNormal.y);
            float bf = h * 0.55;
            float band = sin(normalizedY * bf * 3.14159) * 0.5 + 0.5;
            float fin  = pow(band, 5.0) * 0.09 * isSide;
            localPos  += aNormal * fin;

            // Seitliche Versteifungsrippen (vertikal)
            float ribU = abs(fract(aUV.x * 5.0 + seed) * 2.0 - 1.0);
            float rib  = smoothstep(0.88, 1.0, ribU) * 0.04 * isSide;
            localPos  += aNormal * rib;

            // Dach: unebene Aufbauten (Kühltürme)
            float roof = step(0.93, normalizedY);
            localPos.y += vnoise3(vec3(aPos.x*5.0+seed, 0.0, aPos.z*5.0+seed)) * 0.5 * h * 0.07 * roof;
        }

        else if (archStyle < 3.5) {
            // MIXED: Breiter Sockel + eleganter schlanker Turm
            float isPodium = 1.0 - smoothstep(0.22, 0.28, normalizedY);
            float baseScale  = mix(0.65, 2.4, isPodium);
            float towerTaper = 1.0 - normalizedY * 0.09 * (1.0 - isPodium);
            localPos.xz *= mix(towerTaper, baseScale, isPodium);

            // Terassen am Übergang Sockel→Turm
            float tZone = smoothstep(0.18, 0.22, normalizedY) * smoothstep(0.28, 0.24, normalizedY);
            localPos.y += tZone * 0.04 * h;
        }

        else if (archStyle < 4.5) {
            // BILLBOARD-PFEILER: Sauber, flache Hauptflächen
            float taper = 1.0 - normalizedY * 0.05;
            localPos.xz *= taper;
            // Leichte Wölbung der Hauptfassade
            float isFront = step(0.7, abs(aNormal.z));
            float bulge = 0.022 * (4.0*aUV.x*(1.0-aUV.x)) * (1.0 - abs(normalizedY-0.5)*2.0);
            localPos += aNormal * bulge * isFront;
        }

        else {
            // MEGASTRUKTUR: 5 gestufte Setbacks + vertikale Schächte + Technikbänder
            float s1 = smoothstep(0.18, 0.23, normalizedY) * 0.18;
            float s2 = smoothstep(0.36, 0.41, normalizedY) * 0.14;
            float s3 = smoothstep(0.53, 0.58, normalizedY) * 0.12;
            float s4 = smoothstep(0.70, 0.75, normalizedY) * 0.10;
            float s5 = smoothstep(0.85, 0.89, normalizedY) * 0.08;
            localPos.xz *= (1.0 - s1 - s2 - s3 - s4 - s5);

            // Tiefe vertikale Schächte
            float chU = fract(aUV.x * 6.0 + seed);
            localPos -= aNormal * step(0.88, chU) * 0.09 * (1.0 - abs(aNormal.y));

            // Massive Technik-Horizontalbänder
            float tbMask = smoothstep(0.02, 0.08, abs(fract(normalizedY * h * 0.28) - 0.5) - 0.35);
            localPos += aNormal * tbMask * 0.05 * (1.0 - abs(aNormal.y));

            // Abgechamferte Ecken
            float chamfer = max(0.0, abs(localPos.x/w) + abs(localPos.z/d) - 1.0);
            localPos.xz  -= normalize(localPos.xz + 0.001) * chamfer * 0.10;
        }
    }

    // ======= SOCKEL/PODIUM (part == 1) =======
    else if (part < 1.5) {
        // Flache, breite Basis — immer mit Terassen-Kante oben
        float edgeY = smoothstep(0.88, 0.96, normalizedY);
        localPos.xz -= normalize(localPos.xz + 0.001) * edgeY * 0.12 * (1.0 - abs(aNormal.y));

        // Brutalist/Mega: tiefe Bodenfuge
        if (archStyle < 0.5 || archStyle >= 4.5) {
            float groove = 1.0 - smoothstep(0.0, 0.04, normalizedY);
            localPos.xz *= mix(1.0, 0.88, groove);
        }
        // Glas/Mixed: Schaufenster-Rücksprung unten
        else if (archStyle >= 0.5 && archStyle < 1.5 || archStyle >= 2.5 && archStyle < 3.5) {
            float lobby = smoothstep(0.0, 0.12, normalizedY);
            localPos.xz *= mix(0.85, 1.0, lobby) ;
        }
    }

    // ======= SPITZE/KRONE (part == 2) =======
    else if (part < 2.5) {
        // Extremes Verjüngen von Basis bis zur Spitze (Nadel/Antenne)
        float needle = pow(1.0 - normalizedY, 0.6);
        localPos.xz *= needle;

        // Optionale architektonische Drehung der Spitze
        float spireAng = normalizedY * 0.4 * sign(hash11(seed * 3.1) - 0.5);
        float sc = cos(spireAng), ss = sin(spireAng);
        vec2 sp = vec2(localPos.x*sc - localPos.z*ss, localPos.x*ss + localPos.z*sc);
        localPos.xz = sp;

        // Glas-Spitze: Diamant-Facetten (kleine Einrückungen entlang Kanten)
        if (archStyle >= 0.5 && archStyle < 1.5) {
            float facet = smoothstep(0.5, 0.4, uvEdgeDist(aUV)) * 0.03;
            localPos += aNormal * facet * (1.0 - abs(aNormal.y));
        }
    }

    // ======= FLÜGEL/ANBAU (part == 3) =======
    else {
        // Etwas kürzer, sonst wie Hauptturm (vereinfacht)
        if (archStyle < 0.5) {
            float s1 = smoothstep(0.55, 0.62, normalizedY) * 0.22;
            localPos.xz *= (1.0 - s1);
        } else if (archStyle < 1.5) {
            localPos.xz *= (1.0 - normalizedY * 0.08);
        } else if (archStyle < 2.5) {
            float bf = h * 0.45;
            float fin = pow(sin(normalizedY * bf * 3.14159) * 0.5 + 0.5, 4.0) * 0.08;
            localPos += aNormal * fin * (1.0 - abs(aNormal.y));
        } else if (archStyle < 3.5) {
            float tp = 1.0 - normalizedY * 0.07;
            localPos.xz *= tp;
        }
    }

    // ── Normale korrekt skalieren ───────────────────────────────────────────
    vec3 scaledN = aNormal / vec3(max(w, 0.01), max(h, 0.01), max(d, 0.01));
    vNormal = normalize(scaledN);

    vec3 worldPos = aInstPos.xyz + localPos;
    vWorldPos = worldPos;
    vUV       = aUV;

    gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
