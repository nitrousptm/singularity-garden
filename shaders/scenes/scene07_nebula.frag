#version 460 core
// SCENE 7 BACKGROUND: Volumetric Nebula + God Rays backdrop

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;

// -------- Nebula volumetric --------
vec3 nebulaColor(vec3 rd, float t) {
    vec3 p = rd * t;
    float d = domainWarpFbm(p * 0.3 + uTime * 0.01, 5);
    float d2 = domainWarpFbm(p * 0.6 + vec3(5.1, 2.3, 8.4) + uTime * 0.02, 4);

    // Nebula color zones
    vec3 col1 = vec3(0.3, 0.05, 0.5);   // violet
    vec3 col2 = vec3(0.0, 0.3, 0.6);   // deep blue
    vec3 col3 = vec3(0.5, 0.1, 0.0);   // dark red
    vec3 col4 = vec3(0.0, 0.4, 0.3);   // teal
    vec3 col5 = vec3(0.6, 0.4, 0.0);   // amber

    vec3 nc = mix(mix(col1, col2, d), mix(col3, col4, d2), d * d2);
    nc = mix(nc, col5, pow(d2, 3.0));

    float density = pow(d * 0.7 + 0.3, 2.0) * 0.3;
    return nc * density;
}

// -------- Star field (multiple layers) --------
vec3 stars(vec2 uv, float layer) {
    float scale = mix(200.0, 2000.0, layer / 3.0);
    float brightness = hash12(floor(uv * scale) / scale + layer) ;
    float size = hash12(floor(uv * scale) / scale + layer + 100.0);
    float twinkle = 0.7 + 0.3 * sin(uTime * (2.0 + size * 5.0) + brightness * 6.28);
    float star = pow(brightness, 20.0 - layer * 5.0) * twinkle;
    return vec3(star) * mix(vec3(1.0, 0.9, 0.7), vec3(0.7, 0.9, 1.0), size);
}

// -------- God rays (from singularity center) --------
float godRayStreak(vec2 uv, float angle, float width, float t) {
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 perp = vec2(-dir.y, dir.x);
    float along = dot(uv - 0.5, dir);
    float cross_ = dot(uv - 0.5, perp);
    float streak = exp(-cross_*cross_ / (width*width));
    streak *= exp(-abs(along) * 1.5) * step(0.0, along);  // one-directional
    float flicker = 0.7 + 0.3 * sin(t * 4.0 + angle * 3.0);
    return streak * flicker;
}

// -------- Galactic spiral (background structure) --------
vec3 galacticSpiral(vec2 uv, float t) {
    vec2 p = uv - 0.5;
    float r = length(p);
    float theta = atan(p.y, p.x) + t * 0.02;

    // Two-arm spiral density
    float arm1 = exp(-pow(mod(theta + r * 4.0, 6.28) - 0.0, 2.0) * 3.0);
    float arm2 = exp(-pow(mod(theta + r * 4.0 + 3.14, 6.28), 2.0) * 3.0);
    float arms = (arm1 + arm2) * exp(-r * 2.0);

    // Bulge at center
    float bulge = exp(-r * r * 30.0) * 3.0;

    vec3 armColor   = mix(vec3(0.3, 0.5, 1.0), vec3(1.0, 0.7, 0.3), r * 2.0);
    vec3 bulgeColor = vec3(1.0, 0.9, 0.7);

    return armColor * arms * 0.4 + bulgeColor * bulge;
}

void main() {
    vec2 uv = vUV;
    vec2 ndc = (uv * 2.0 - 1.0);
    ndc.x *= uResolution.x / uResolution.y;

    // Ray direction
    float fov = radians(70.0);
    vec3 rd = normalize(vec3(ndc * tan(fov * 0.5), -1.0));
    rd.xz = mat2(cos(uTime*0.03), -sin(uTime*0.03), sin(uTime*0.03), cos(uTime*0.03)) * rd.xz;

    // Deep space background
    vec3 col = vec3(0.0, 0.0, 0.005);

    // Star layers
    for (float l = 0.0; l < 3.0; l++)
        col += stars(uv, l);

    // Galactic spiral
    float galaxyBright = smoothstep(0.0, 0.5, uProgress);
    col += galacticSpiral(uv, uTime) * galaxyBright;

    // Nebula volumetric march
    float nebulaBright = uProgress;
    vec3 nebula = vec3(0.0);
    for (int i = 0; i < 16; i++) {
        float t = 1.0 + float(i) * 3.0;
        nebula += nebulaColor(rd, t) * 0.8;
    }
    col += nebula * nebulaBright;

    // God rays from center (singularity)
    int numRays = 8 + int(uProgress * 8.0);
    vec3 rayColor = vec3(0.0);
    for (int i = 0; i < 16; i++) {
        if (i >= numRays) break;
        float angle = float(i) * 3.14159 * 2.0 / float(numRays) + uTime * 0.05;
        float width = 0.01 + 0.02 * sin(float(i) * 1.7 + uTime * 0.3);
        float rays  = godRayStreak(uv, angle, width, uTime);
        vec3 rayCol = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.5, 0.2), float(i)/float(numRays));
        rayColor += rayCol * rays;
    }
    col += rayColor * 0.6 * uProgress;

    // Central singularity glow
    float center = exp(-length(uv - 0.5) * 5.0);
    float pulse  = 1.0 + 0.3 * sin(uTime * 3.0) + 0.1 * pow(1.0-uBeatPhase, 6.0) * uBeatStrength;
    col += vec3(0.5, 0.8, 1.0) * center * pulse * 2.0 * uProgress;

    // Beat: shockwave rings expanding from center
    float beatRing = abs(length(uv - 0.5) - fract(uTime * 133.0/60.0 / 4.0) * 0.8);
    float ring = exp(-beatRing * 30.0) * uBeatStrength * 0.3;
    col += vec3(0.3, 0.6, 1.0) * ring;

    fragColor = vec4(col, 1.0);
}
