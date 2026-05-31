#version 460 core
// SCENE 3: CITY CORRUPTION — Fragment Shader
// Techniken: Worley-Beton, Parallax-Fenster, Glas-Fresnel, Brushed-Metal BRDF,
//            Neon-Schilder, Kristalline Korruption, Multi-Light PBR

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
uniform vec3  uCameraPos;
uniform vec2  uResolution;

// ============================================================
// MATERIAL-FUNKTIONEN
// ============================================================

// ---- Worley-Beton-Platte (Fugen + Aggregat-Textur) --------
float concretePanel(vec2 uv, float seed, float scale) {
    // voronoi2 gibt vec2(dist, cellID) zurück
    vec2 vc     = voronoi2(uv * scale + seed * 3.7);
    float dist  = vc.x;
    float cellID = vc.y;
    float joint = 1.0 - smoothstep(0.04, 0.11, dist); // scharfe Fugen
    float agg   = fbm2(uv * scale * 5.0 + cellID + seed, 4, 2.0, 0.48);
    // Schatten in den Fugen
    return mix(agg, 0.0, joint * 0.85);
}

// ---- Parallax-Fenster-Interior --------
// Simuliert Tiefe im Fenster durch View-Direction-Offset
vec3 windowInterior(vec2 winUV, vec3 viewDir, vec3 N, float seed, float t) {
    // Tangentialer View-Anteil für Parallax
    vec3 tangentUp  = normalize(vec3(0, 1, 0) - N * dot(N, vec3(0,1,0)));
    vec3 tangentSide = normalize(cross(N, tangentUp));
    float pvX = dot(viewDir, tangentSide) * 0.35;
    float pvY = dot(viewDir, tangentUp)   * 0.25;

    vec2 interiorUV = winUV + vec2(pvX, pvY);

    // Raumfarbe: warm (Büro) oder kalt (Server)
    float warmCool = hash12(vec2(seed, floor(seed * 3.7)));
    vec3 warmLight = vec3(1.0, 0.82, 0.55);
    vec3 coolLight = vec3(0.55, 0.75, 1.0);
    vec3 roomColor = mix(warmLight, coolLight, warmCool);

    // Grobe Innenraum-Silhouette (Decke dunkler, Möbel unten)
    float ceiling = smoothstep(0.78, 0.95, interiorUV.y) * 0.7;
    float desk    = step(0.62, hash12(floor(interiorUV * 2.5 + seed)));

    // Flicker (TV, Neon-Röhren)
    float rate    = hash11(seed + 0.33) * 10.0 + 2.0;
    float flicker = step(0.07, fract(t * rate + hash11(seed))) * 0.85 + 0.15;

    return roomColor * flicker * (1.0 - ceiling * 0.65) * (1.0 - desk * 0.35);
}

// ---- Glas-Fassade: Schlick-Fresnel + Fake-Umgebungsreflektion --------
vec3 glassFacade(vec3 N, vec3 V, float t, float beatBoost, float corrupt) {
    float F0      = 0.04;
    float cosTheta = max(dot(N, V), 0.0);
    float fresnel  = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);

    vec3 R = reflect(-V, N);
    float hR = R.y * 0.5 + 0.5;

    // Nacht-Himmel + Stadtlicht-Leck
    vec3 skyEnv  = mix(vec3(0.18, 0.06, 0.30), vec3(0.00, 0.00, 0.04), pow(hR, 0.35));
    // Zufällige Neon-Reflexe auf Glas
    float neonR  = hash12(R.xz * 4.0 + floor(t * 0.5));
    vec3  neonRef = mix(vec3(1.0, 0.1, 0.4), vec3(0.1, 0.9, 1.0), neonR) * step(0.65, neonR);
    skyEnv += neonRef * 0.25;

    // Korruptions-Färbung der Reflektion
    vec3 corruptRef = mix(vec3(0.0, 0.8, 0.3), vec3(0.8, 0.0, 1.0), sin(t * 0.4) * 0.5 + 0.5);
    skyEnv = mix(skyEnv, skyEnv + corruptRef * 0.4, corrupt);

    // Beat-Lichtblitz
    skyEnv += vec3(0.15, 0.35, 1.0) * beatBoost * 0.25;

    return skyEnv * (fresnel + 0.12);
}

// ---- Anisotropes Brushed-Metal-Highlight (vertikal gebürstet) --------
vec3 brushedMetalSpec(vec3 N, vec3 V, vec3 L, float anisotropy) {
    vec3  H    = normalize(V + L);
    float NdH  = max(dot(N, H), 0.0);
    float NdL  = max(dot(N, L), 0.0);
    float NdV  = max(dot(N, V), 0.0);
    float VdH  = max(dot(V, H), 0.0);

    // Vertikale Richtung im Weltraum (Gebäude stehen aufrecht)
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 T  = normalize(cross(N, up) + 0.001 * N);
    float TdH = dot(T, H);

    float roughX = mix(0.08, 0.6, 1.0 - anisotropy); // entlang Bürst-Richtung
    float roughY = 0.55;                              // quer dazu
    float sinXSq = max(0.0, 1.0 - TdH * TdH);
    float sinYSq = max(0.0, 1.0 - NdH * NdH);
    float D = exp(-(sinXSq / (roughX * roughX) + sinYSq / (roughY * roughY)));
    D /= (PI * roughX * roughY);

    float G = min(1.0, min(2.0 * NdH * NdV / (VdH + 0.001),
                           2.0 * NdH * NdL / (VdH + 0.001)));
    vec3 F = vec3(0.65) + (1.0 - vec3(0.65)) * pow(1.0 - VdH, 5.0);

    return (D * G * F) / (4.0 * NdV * NdL + 0.001) * NdL;
}

// ---- Neon-Schild (komplex: Buchstaben-Segmente, Leuchthof) --------
vec3 neonSign(vec2 uv, float seed, float t, float corrupt) {
    // 7 Zeichen-Segmente breit, 3 Zeilen hoch
    float segW = 7.0, segH = 3.0;
    float col  = floor(uv.x * segW);
    float row  = floor(uv.y * segH);
    float lx   = fract(uv.x * segW);
    float ly   = fract(uv.y * segH);

    float segHash  = hash12(vec2(col + seed * 19.3, row + seed * 7.1));
    float beatPulse = pow(max(0.0, 1.0 - uBeatPhase * 2.5), 2.0) * uBeatStrength;

    // Zufälliges Ein-/Ausschalten (simuliert Buchstaben)
    float onRate = hash11(seed + col * 0.31 + row * 0.71) * 6.0 + 1.0;
    float on     = step(0.2, fract(segHash + t * onRate * 0.15));

    // Korruptions-Flicker
    float corruptFl = mix(1.0, step(0.18, fract(t * 14.0 + segHash)), corrupt * 0.85);
    on *= corruptFl;

    // Neon-Farben pro Gebäude: wählt aus 4 Paletten
    float palIdx = hash11(seed + 2.3);
    vec3 c0 = vec3(1.0, 0.08, 0.38); // Hot Pink
    vec3 c1 = vec3(0.08, 0.95, 1.0); // Cyan
    vec3 c2 = vec3(1.0, 0.55, 0.05); // Orange
    vec3 c3 = vec3(0.45, 0.1, 1.0);  // Violett
    vec3 neonColor;
    if      (palIdx < 0.25) neonColor = mix(c0, c1, row / segH);
    else if (palIdx < 0.50) neonColor = mix(c1, c2, row / segH);
    else if (palIdx < 0.75) neonColor = mix(c2, c3, row / segH);
    else                    neonColor = mix(c3, c0, row / segH);

    // Segment-Umriss (Schrift-Silhouette)
    float inner = step(0.10, lx) * step(lx, 0.90) * step(0.14, ly) * step(ly, 0.86);
    // Senkrechter Segment-Balken (simuliert Teil eines Buchstabens)
    float vBar  = step(0.38, lx) * step(lx, 0.62) * step(0.08, ly) * step(ly, 0.92)
                * step(0.5, hash11(segHash + 0.1));
    float shape = max(inner * 0.6, vBar);

    // Leuchthof
    float glow = exp(-min(lx, 1.0 - lx) * 12.0) * exp(-min(ly, 1.0 - ly) * 12.0) * 0.4;

    float brightness = 2.8 + beatPulse * 1.2;
    return neonColor * (shape + glow) * on * brightness;
}

// ---- Kristalline Korruptions-Emission --------
vec3 crystallineCorruption(vec3 worldPos, float corrupt, float t, float barPhase) {
    // Doppelt domain-warped FBM → maximale Komplexität
    float f1 = domainWarpFbm(worldPos * 0.55 + t * 0.035, 5);
    float f2 = fbm3(worldPos * 3.2  - t * 0.055, 4, 2.0, 0.5);
    float f3 = vnoise3(worldPos * 8.0 + t * 0.08) * 0.5 + 0.5;

    // Kristall-Facetten: scharfe Kanten aus FBM-Thresholding
    float facet1 = pow(max(0.0, f1 - 0.44), 2.8);
    float facet2 = pow(max(0.0, 0.96 - f1), 10.0) * pow(f3, 2.0);  // Spitze Kristalle
    float facet3 = smoothstep(0.48, 0.52, f2) * facet1;             // Schicht-Linien

    // Farb-Wechsel mit Bar-Phase (grün/violett → cyan/orange)
    vec3 colA = mix(vec3(0.0, 1.0, 0.25), vec3(0.85, 0.0, 1.0), barPhase);
    vec3 colB = mix(vec3(0.0, 0.55, 1.0), vec3(1.0, 0.25, 0.0), barPhase);
    vec3 colC = vec3(1.0, 1.0, 0.9); // Weiß-glühende Spitzen

    float beatBoost = pow(max(0.0, 1.0 - uBeatPhase * 2.2), 2.0) * uBeatStrength;
    float intensity = pow(corrupt, 1.4) * (1.0 + beatBoost * 2.0);

    return (colA * facet1 + colB * facet3 + colC * facet2 * 3.0) * intensity * 4.5;
}

// ---- Stadt-Atmosphären-Nebel --------
vec3 cityFog(float dist, float height, float corrupt) {
    // Schichten: Bodennebel (warm/orange) + Smog (lila bei Korruption)
    float groundFog   = exp(-max(0.0, height + 7.0) * 0.15);
    vec3  nightSmog   = mix(vec3(0.055, 0.020, 0.010), vec3(0.020, 0.040, 0.012), corrupt);
    vec3  corruptSmog = mix(vec3(0.025, 0.008, 0.040), vec3(0.0, 0.060, 0.020), corrupt);
    return mix(nightSmog, corruptSmog, groundFog * corrupt * 0.7);
}

// ============================================================
// MAIN
// ============================================================

void main() {
    vec3  N = normalize(vNormal);
    vec3  V = normalize(uCameraPos - vWorldPos);
    float btype   = vBuildingType;
    float corrupt = vCorruption;
    float seed    = vSeed;

    float beatBoost = pow(max(0.0, 1.0 - uBeatPhase * 2.0), 2.0) * uBeatStrength;
    float barPulse  = pow(max(0.0, 1.0 - uBarPhase  * 5.0), 3.0) * uBeatStrength;

    // ---- LICHTQUELLEN ----
    // Mond (kalt, diagonal)
    vec3 moonDir = normalize(vec3(0.32, 0.72, 0.38));
    vec3 moonCol = vec3(0.50, 0.60, 0.82) * 2.4;

    // Stadtlicht-Füllung von unten (Smog-Rückstreuung)
    vec3 fillDir = normalize(vec3(-0.15, -0.55, 0.28));
    vec3 fillCol = mix(vec3(0.40, 0.15, 0.06), vec3(0.30, 0.06, 0.42), corrupt) * 0.85;

    // Korruptions-Licht (pulsiert mit BPM)
    vec3 corruptLightDir = normalize(vec3(sin(uTime * 0.22), 0.25, cos(uTime * 0.22)));
    vec3 corruptLightCol = mix(vec3(0.0, 0.8, 0.3), vec3(0.7, 0.0, 1.0), uBarPhase)
                         * corrupt * (1.2 + beatBoost * 1.5);

    // Straßen-Neon (farbig, rotiert langsam)
    vec3 streetDir = normalize(vec3(sin(uTime * 0.13 + 1.0), 0.15, cos(uTime * 0.13 + 1.0)));
    vec3 streetCol = mix(vec3(1.0, 0.18, 0.40), vec3(0.15, 0.85, 1.0), uBarPhase) * 1.6;

    // ---- MATERIAL PRO TYP ----
    vec3  albedo    = vec3(0.3);
    float metallic  = 0.0;
    float roughness = 0.8;
    vec3  emission  = vec3(0.0);

    // --- TYPE 0: BRUTALIST BETON ---
    if (btype < 0.5) {
        // Worley-Beton-Platten (groß)
        float panel1 = concretePanel(vUV, seed, 3.2);
        // Überlagerte feinere Platten
        float panel2 = concretePanel(vUV * 2.5 + 0.3, seed, 6.0);
        float panel  = panel1 * 0.7 + panel2 * 0.3;

        // Basis-Beton: grau mit leichtem Gelbton (verwittert)
        vec3 concBase = mix(vec3(0.34, 0.31, 0.27), vec3(0.16, 0.15, 0.13), panel);

        // Feuchtigkeits-Streifen (vertikal, Regen-Abfluss)
        float stain = pow(fbm2(vec2(vUV.x, vUV.y * 0.3) * 3.0 + seed, 3, 2.0, 0.5), 1.5);
        concBase = mix(concBase, concBase * vec3(0.6, 0.65, 0.6), stain * 0.5);

        // Korruptions-Färbung: Kristall-Moos
        float corruptStain = domainWarpFbm(vWorldPos * 0.25 + seed, 3);
        vec3 crystalMoss   = mix(vec3(0.05, 0.30, 0.08), vec3(0.35, 0.0, 0.50), corruptStain);
        albedo    = mix(concBase, crystalMoss, corrupt * 0.80);
        metallic  = mix(0.0, 0.35, corrupt);
        roughness = mix(0.92, 0.30, corrupt);
    }

    // --- TYPE 1: GLAS-TURM ---
    else if (btype < 1.5) {
        // Glasplatten-Grid mit Metallrahmen
        float cols = 6.0;
        float rows = max(1.0, vHeight * 0.38);
        vec2 gGrid = fract(vUV * vec2(cols, rows));
        float frameH = smoothstep(0.03, 0.07, gGrid.x) * smoothstep(0.97, 0.93, gGrid.x);
        float frameV = smoothstep(0.04, 0.08, gGrid.y) * smoothstep(0.96, 0.92, gGrid.y);
        float glass  = frameH * frameV;  // 1=Glas, 0=Rahmen

        vec3 frameCol = mix(vec3(0.12, 0.12, 0.15), vec3(0.28, 0.16, 0.08), corrupt);
        vec3 glassCol = glassFacade(N, V, uTime, beatBoost, corrupt);

        albedo    = mix(frameCol, glassCol, glass);
        metallic  = mix(0.95, 0.25, glass);
        roughness = mix(0.15, 0.60, glass * (1.0 - corrupt * 0.5));

        // Glas-Emission: intern leuchtendes Glas bei Korruption
        vec3 glassEmit = mix(vec3(0.0), vec3(0.0, 0.5, 1.0), corrupt * glass * 0.4);
        emission += glassEmit * (1.0 + beatBoost);
    }

    // --- TYPE 2: INDUSTRIAL STAHL ---
    else if (btype < 2.5) {
        // Gebürstetes Metall: vertikale Streifen-Textur
        float brushV = fbm2(vec2(vUV.x * 18.0 + seed, vUV.y * 0.3), 3, 2.0, 0.5);
        // Horizontale Bänder (Strukturgliederung)
        float bandH  = fract(vNormalizedY * vHeight * 0.7);
        float bandMask = smoothstep(0.0, 0.08, bandH) * smoothstep(1.0, 0.92, bandH);

        vec3 steelDark  = vec3(0.07, 0.08, 0.10);
        vec3 steelMid   = vec3(0.15, 0.17, 0.20);
        vec3 steelLight = vec3(0.25, 0.27, 0.30);
        vec3 steel = mix(steelDark, mix(steelMid, steelLight, brushV), bandMask);

        // Rost-Texturen
        float rust = pow(fbm2(vUV * 4.0 + seed * 2.7, 3, 2.0, 0.5), 2.0);
        vec3 rustCol = vec3(0.38, 0.16, 0.04);
        steel = mix(steel, rustCol, rust * 0.35);

        // Korruptions-Patina (Kupfergrün-like)
        vec3 patina = mix(steel, vec3(0.04, 0.38, 0.18), corrupt * 0.55);
        albedo    = patina;
        metallic  = mix(0.88, 0.70, rust + corrupt * 0.2);
        roughness = mix(0.28, 0.50, rust + corrupt * 0.3);
    }

    // --- TYPE 3: GEMISCHT (Sockel + Turm) ---
    else {
        float isPodium = 1.0 - smoothstep(0.27, 0.33, vNormalizedY);
        // Sockel: Granit / dunkler Stein
        float gran = fbm2(vUV * 14.0 + seed, 5, 2.0, 0.5);
        vec2 granVor = voronoi2(vUV * 6.0 + seed * 2.1);
        float granStone = gran * 0.6 + (1.0 - granVor.x) * 0.4;
        vec3 granite = mix(vec3(0.26, 0.23, 0.21), vec3(0.10, 0.09, 0.10), granStone);

        // Turm: Dunkles Metall-Glas
        vec3 towerDark = mix(vec3(0.04, 0.04, 0.09), vec3(0.10, 0.03, 0.16), corrupt);

        albedo    = mix(towerDark, granite, isPodium);
        metallic  = mix(mix(0.75, 0.02, isPodium), 0.55, corrupt);
        roughness = mix(mix(0.18, 0.85, isPodium), 0.28, corrupt);
    }

    // ============================================================
    // FENSTER-SYSTEM (alle Typen außer Boden/Dach)
    // ============================================================
    float isWall = step(abs(N.y), 0.28);

    float winCols = (btype < 0.5) ? 4.0 : (btype < 1.5) ? 6.0 : (btype < 2.5) ? 3.0 : 5.0;
    float winRows = max(1.0, floor(vHeight * 0.42));
    vec2  winGrid = vUV * vec2(winCols, winRows);
    vec2  winCell = floor(winGrid);
    vec2  winUV   = fract(winGrid);

    // Fenster-Rahmen-Innen-Maske
    float fx = step(0.07, winUV.x) * step(winUV.x, 0.93);
    float fy = step(0.09, winUV.y) * step(winUV.y, 0.91);
    float winGlass = fx * fy;

    // Jedes Fenster an oder aus
    float winSeed  = hash12(winCell + vec2(seed * 13.7, seed * 7.3));
    float winOn    = step(0.18, winSeed);  // 82% leuchten

    // Parallax-Interior
    vec3 viewDir   = normalize(uCameraPos - vWorldPos);
    vec3 interior  = windowInterior(winUV, viewDir, N, winSeed, uTime);

    float winMask = winGlass * winOn * isWall;
    // Glas-Typ: Fenster fusionieren mit der Glasfassade
    if (btype >= 0.5 && btype < 1.5) winMask *= 0.45;
    emission += interior * winMask * 2.8;

    // ---- NEON-SCHILDER (untere 50% der Gebäudehöhe) ----
    float neonBand = smoothstep(0.04, 0.22, vNormalizedY)
                   * (1.0 - smoothstep(0.45, 0.58, vNormalizedY));
    float hasNeon  = step(0.52, hash11(seed + 0.91));

    if (isWall > 0.5 && neonBand > 0.05 && hasNeon > 0.5) {
        vec2 nUV  = vUV;
        nUV.y     = clamp((nUV.y - 0.04) / 0.45, 0.0, 1.0);
        vec3 neon = neonSign(nUV, seed, uTime, corrupt);
        emission += neon * neonBand;
    }

    // ---- DACH-WARNLICHTER (rote Blink-Lichter auf Antennen) ----
    float isTop   = step(abs(N.y - 1.0), 0.2) * step(0.95, vNormalizedY);
    float blinkOn = step(0.70, hash11(seed + 0.55))
                  * (sin(uTime * (1.8 + hash11(seed) * 3.5)) * 0.5 + 0.5);
    emission += vec3(1.0, 0.04, 0.04) * blinkOn * isTop * 6.0;

    // ---- KRISTALLINE KORRUPTIONS-EMISSION ----
    vec3 crystalEmit = crystallineCorruption(vWorldPos, corrupt, uTime, uBarPhase);
    emission += crystalEmit;

    // ============================================================
    // PBR SHADING — 4 Lichtquellen
    // ============================================================
    vec3 shading = vec3(0.0);

    shading += cookTorrance(N, V, moonDir,        albedo, metallic, roughness) * moonCol;
    shading += cookTorrance(N, V, -fillDir,       albedo, metallic, roughness) * fillCol;
    shading += cookTorrance(N, V, streetDir,      albedo, metallic, roughness) * streetCol
             * (0.25 + beatBoost * 0.75);
    shading += cookTorrance(N, V, corruptLightDir, albedo, metallic, roughness) * corruptLightCol;

    // Anisotropes Brushed-Metal für Type 2
    if (btype >= 1.5 && btype < 2.5) {
        vec3 bmSpec = brushedMetalSpec(N, V, moonDir, 0.72);
        shading += bmSpec * moonCol * metallic * 0.6;
    }

    // Ambiente (IBL-Approximation: Himmel + Bodenlicht)
    vec3 envSky = vec3(0.006, 0.008, 0.022);
    vec3 envGnd = mix(vec3(0.055, 0.022, 0.010), vec3(0.018, 0.070, 0.015), corrupt);
    float hemiFactor = N.y * 0.5 + 0.5;
    shading += albedo * mix(envGnd, envSky, hemiFactor) * (1.0 - metallic * 0.5);

    // Emission addieren
    shading += emission;

    // BPM Bar-Flash (globale Aufhellung bei Bar-Start)
    shading += mix(vec3(0.08, 0.04, 0.25), vec3(0.0, 0.15, 0.08), corrupt)
             * barPulse * 0.45;

    // ---- ATMOSPHÄREN-NEBEL ----
    float dist      = length(uCameraPos - vWorldPos);
    float fogFactor = 1.0 - exp(-dist * 0.0075);
    vec3  fogColor  = cityFog(dist, vWorldPos.y, corrupt);
    shading = mix(shading, fogColor, fogFactor);

    fragColor = vec4(shading, 1.0);
}
