#version 460 core
// SCENE 3: Nasse Stadtstrasse
// Wet Asphalt + Pfützen-Reflexionen + Strassenmarkierungen + Korruptions-Hex-Grid

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

// ---- Wasser-Ripple-Normal (animiert) --------
vec3 waterNormal(vec2 p, float t) {
    // Zwei überlagerte Wellen-Sets für komplexe Wasseroberfläche
    vec2 p1 = p * 3.5 + vec2(t * 0.12, t * 0.08);
    vec2 p2 = p * 6.0 + vec2(-t * 0.07, t * 0.15);
    vec2 p3 = p * 12.0 + vec2(t * 0.22, -t * 0.11);

    float h1 = fbm2(p1, 4, 2.0, 0.5);
    float h2 = fbm2(p2, 3, 2.0, 0.5) * 0.5;
    float h3 = vnoise2(p3) * 0.25;

    // Gradient → Normalvektor
    const float e = 0.015;
    float dx = (fbm2(p1 + vec2(e,0), 3, 2.0, 0.5) - fbm2(p1 - vec2(e,0), 3, 2.0, 0.5)) * 0.5
             + (fbm2(p2 + vec2(e,0), 2, 2.0, 0.5) - fbm2(p2 - vec2(e,0), 2, 2.0, 0.5)) * 0.25;
    float dz = (fbm2(p1 + vec2(0,e), 3, 2.0, 0.5) - fbm2(p1 - vec2(0,e), 3, 2.0, 0.5)) * 0.5
             + (fbm2(p2 + vec2(0,e), 2, 2.0, 0.5) - fbm2(p2 - vec2(0,e), 2, 2.0, 0.5)) * 0.25;

    return normalize(vec3(-dx, 1.0, -dz));
}

// ---- Asphalt-Textur --------
float asphaltTexture(vec2 p, float seed) {
    float coarse = fbm2(p * 1.2, 3, 2.0, 0.55);
    float fine   = vnoise2(p * 8.0 + seed) * 0.3;
    float crack  = 1.0 - smoothstep(0.04, 0.10, abs(coarse - 0.5));
    return coarse * 0.6 + fine * 0.4 - crack * 0.15;
}

// ---- Strassenmarkierungen --------
float roadMarkings(vec2 worldXZ) {
    // Mittellinie (gestrichelt)
    float lineWidth = 0.12;
    float dashLen   = 4.0;
    float dashGap   = 3.0;
    float period    = dashLen + dashGap;

    // Hauptachse X
    float lineX = smoothstep(lineWidth, lineWidth * 0.5, abs(worldXZ.y))
                * step(fract(worldXZ.x / period), dashLen / period);
    // Hauptachse Z
    float lineZ = smoothstep(lineWidth, lineWidth * 0.5, abs(worldXZ.x))
                * step(fract(worldXZ.y / period), dashLen / period);

    // Fussgängerüberweg (Streifen)
    float crossX = step(6.0, abs(worldXZ.x)) * step(abs(worldXZ.x), 7.5)
                 * smoothstep(0.4, 0.3, abs(fract(worldXZ.y * 0.8) - 0.5));
    float crossZ = step(6.0, abs(worldXZ.y)) * step(abs(worldXZ.y), 7.5)
                 * smoothstep(0.4, 0.3, abs(fract(worldXZ.x * 0.8) - 0.5));

    return max(max(lineX, lineZ), max(crossX, crossZ));
}

// ---- Pfützen-Maske (Worley-basiert) --------
float puddleMask(vec2 p) {
    vec2 vc = voronoi2(p * 0.5);
    float dist = vc.x;
    // Pfützen: flache Bereiche des Voronoi-Diagramms
    return smoothstep(0.35, 0.20, dist);
}

// ---- Reflexions-Farbe (Fake-Reflexion der Stadtlichter) --------
vec3 streetReflection(vec3 N, vec3 V, float t, float barPhase, float corrupt) {
    vec3 R = reflect(-V, N);

    // Stadt-Ambiente-Reflektion
    float hR = R.y * 0.5 + 0.5;
    vec3 skyRef  = vec3(0.01, 0.01, 0.04);
    vec3 gndRef  = mix(vec3(0.08, 0.03, 0.02), vec3(0.03, 0.12, 0.02), corrupt);

    // Neon-Lichtquellen (harte Reflexe, mehrere Farben)
    vec3 neon1 = vec3(1.0, 0.08, 0.40) * step(0.88, hash12(R.xz * 3.0 + vec2(1.7, t * 0.1)));
    vec3 neon2 = vec3(0.08, 0.90, 1.0) * step(0.90, hash12(R.xz * 4.0 + vec2(t * 0.08, 3.1)));
    vec3 neon3 = vec3(1.0, 0.55, 0.05) * step(0.92, hash12(R.xz * 5.0 + vec2(2.3, t * 0.13)));
    vec3 neon4 = mix(vec3(0.0, 0.8, 0.3), vec3(0.7, 0.0, 1.0), barPhase)
               * corrupt * step(0.85, hash12(R.xz * 3.5 + t * 0.05));

    return mix(gndRef, skyRef, hR)
         + (neon1 + neon2 + neon3) * 0.4
         + neon4 * 0.6;
}

// ---- Korruptions-Hex-Grid auf Asphalt --------
float hexCorrupt(vec2 worldXZ, float corrupt, float t) {
    // hexGrid ist in sdf.glsl — imitieren wir hier mit voronoi
    // (hexGrid erwartet 2D UV, skalieren wir entsprechend)
    vec2 uv = worldXZ * 0.05 + 0.5;

    // Grob + fein überlagert
    vec2 vc1 = voronoi2(worldXZ * 0.08);
    vec2 vc2 = voronoi2(worldXZ * 0.20 + 7.3);
    float edge1 = smoothstep(0.12, 0.02, vc1.x); // Gitter-Kanten
    float edge2 = smoothstep(0.08, 0.01, vc2.x);

    float pulse = (1.0 + sin(t * 3.0 - length(worldXZ) * 0.3) * 0.5) * 0.5;
    return (edge1 * 0.7 + edge2 * 0.3) * pow(corrupt, 1.2) * pulse;
}

// ---- BPM-Shockwave-Ring auf dem Boden --------
float groundShockwave(vec2 worldXZ, float beatPhase, float strength) {
    float radius = beatPhase * 18.0;
    float dist   = length(worldXZ);
    float ring   = abs(dist - radius);
    float width  = 0.5 + beatPhase * 1.0;
    return exp(-ring / width) * (1.0 - beatPhase) * strength;
}

void main() {
    vec2  worldXZ = vWorldPos.xz;
    vec3  N       = vec3(0.0, 1.0, 0.0);
    vec3  V       = normalize(uCameraPos - vWorldPos);
    float corrupt = uProgress;

    float beatBoost = pow(max(0.0, 1.0 - uBeatPhase * 2.0), 2.0) * uBeatStrength;
    float barPulse  = pow(max(0.0, 1.0 - uBarPhase  * 5.0), 3.0) * uBeatStrength;

    // ---- ASPHALT BASISMATERIAL ----
    float asp  = asphaltTexture(worldXZ * 0.08, 1.7);
    vec3 asphaltColor = mix(vec3(0.048, 0.048, 0.055), vec3(0.025, 0.025, 0.030), asp);

    // ---- STRASSENMARKIERUNGEN ----
    float markings = roadMarkings(worldXZ * 0.5);
    vec3  markColor = vec3(0.7, 0.65, 0.55);  // vergilbte Farbe
    asphaltColor = mix(asphaltColor, markColor, markings * 0.7);

    // ---- PFÜTZEN ----
    float puddle = puddleMask(worldXZ * 0.04);
    // In Pfützen: Wasser-Normalvektor
    vec3 waterN = waterNormal(worldXZ * 0.04, uTime);
    N = mix(N, waterN, puddle * 0.85);

    // ---- NASSE ASPHALT-SPIEGELUNG ----
    float wetness = mix(0.6, 1.0, puddle);  // Pfützen sind maximalnass
    float F0 = 0.04;
    float cosTheta = max(dot(N, V), 0.0);
    float fresnel  = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    fresnel *= wetness;

    vec3 refl = streetReflection(N, V, uTime, uBarPhase, corrupt);
    vec3 albedo = asphaltColor;

    // Feuchtigkeits-Abdunklung
    albedo *= mix(1.0, 0.62, wetness * 0.6);

    // ---- MATERIAL PROPERTIES ----
    float metallic  = 0.0;
    float roughness = mix(0.92, 0.05, wetness * (puddle * 0.7 + 0.3));

    // ---- BELEUCHTUNG ----
    vec3 moonDir = normalize(vec3(0.32, 0.72, 0.38));
    vec3 moonCol = vec3(0.50, 0.60, 0.82) * 2.0;

    vec3 shading = cookTorrance(N, V, moonDir, albedo, metallic, roughness) * moonCol;

    // Ambiente Stadt-Licht
    vec3 cityAmb = mix(vec3(0.035, 0.015, 0.008), vec3(0.015, 0.050, 0.010), corrupt);
    shading += albedo * cityAmb;

    // Fresnel-Reflektion auf nasser Oberfläche
    shading = mix(shading, refl, fresnel);

    // ---- KORRUPTIONS-HEX-GRID ----
    float hexGlow  = hexCorrupt(worldXZ, corrupt, uTime);
    vec3  hexColor = mix(vec3(0.0, 1.0, 0.3), vec3(0.7, 0.0, 1.0), uBarPhase);
    shading += hexColor * hexGlow * (1.5 + beatBoost * 1.5);

    // ---- BPM-SHOCKWAVE ----
    float shock = groundShockwave(worldXZ, uBeatPhase, uBeatStrength);
    vec3  shockColor = mix(vec3(0.0, 0.5, 1.0), vec3(0.5, 0.0, 1.0), uBarPhase);
    shading += shockColor * shock * 2.0;

    // Bar-Blitz (großer Lichtimpuls)
    shading += mix(vec3(0.05, 0.02, 0.20), vec3(0.02, 0.15, 0.05), corrupt)
             * barPulse * 0.6;

    // ---- DISTANZ-NEBEL ----
    float dist = length(uCameraPos - vWorldPos);
    float fogFactor = 1.0 - exp(-dist * 0.007);
    vec3  fogColor  = mix(vec3(0.010, 0.010, 0.025),
                          vec3(0.015, 0.040, 0.010), corrupt);
    shading = mix(shading, fogColor, fogFactor);

    fragColor = vec4(shading, 1.0);
}
