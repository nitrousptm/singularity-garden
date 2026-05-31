#version 460 core
// SCENE 6: IMPOSSIBLE SPACE — Recursive Universes, Mandelbulb, THE HOLY-SHIT-MOMENT
// Duration: 2:30 - 3:00 (30 seconds)
// Camera reveals: the universe we're in is a particle in a larger universe

#include "../common/noise.glsl"
#include "../common/sdf.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;    // 0..1
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;

// -------- Mandelbulb SDF (power 8) --------
float sdMandelbulb(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r  = 0.0;
    const int MAX_ITER = 12;
    const float POWER = 8.0;

    for (int i = 0; i < MAX_ITER; i++) {
        r = length(z);
        if (r > 2.0) break;

        // Convert to spherical
        float theta  = acos(z.z / r);
        float phi    = atan(z.y, z.x);
        dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;

        // Scale and rotate the point
        float zr = pow(r, POWER);
        theta *= POWER;
        phi   *= POWER;

        // Convert back to cartesian
        z = zr * vec3(
            sin(theta)*cos(phi),
            sin(phi)*sin(theta),
            cos(theta));
        z += pos;
    }
    return 0.5 * log(r) * r / dr;
}

// Orbit trap coloring for Mandelbulb
vec4 mandelbulbColor(vec3 pos) {
    vec3 z = pos;
    float r = 0.0;
    vec4 trap = vec4(abs(z), dot(z,z));
    const float POWER = 8.0;

    for (int i = 0; i < 12; i++) {
        r = length(z);
        if (r > 2.0) break;
        trap = min(trap, vec4(abs(z), dot(z,z)));

        float theta = acos(z.z/r) * POWER;
        float phi   = atan(z.y, z.x) * POWER;
        float zr    = pow(r, POWER);
        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta)) + pos;
    }
    return trap;
}

// -------- Portal rendering --------
vec2 portalUV(vec2 uv, vec2 center, float radius, float strength) {
    vec2 delta = uv - center;
    float dist = length(delta);
    if (dist < radius) {
        float warp = (1.0 - dist/radius);
        delta *= 1.0 + warp * warp * strength;
    }
    return center + delta;
}

// -------- Non-Euclidean space --------
vec3 nonEuclideanPos(vec3 p, float t) {
    // Hopf fibration-inspired warp
    float r = length(p);
    float theta = atan(p.y, p.x) + t * 0.1;
    float phi   = acos(p.z / max(r, 0.001)) + t * 0.07;

    // Inverse stereographic projection (non-Euclidean)
    float proj = 1.0 + r * r;
    return vec3(2.0*p.x/proj, 2.0*p.y/proj, (r*r-1.0)/proj) * 3.0;
}

// -------- Universe-in-particle zoom effect --------
float universeParticle(vec3 p, float t) {
    // Each point in space contains a tiny universe (recursive)
    vec3 q = mod(p * 20.0 + t * 0.3, 4.0) - 2.0;
    float inner = sdMandelbulb(q * 0.5) * 0.05;
    float shell = sdSphere(q, 0.3) - inner;
    return shell;
}

// -------- Raymarcher --------
vec2 rayMarch6(vec3 ro, vec3 rd) {
    float t = 0.001;
    float matID = 0.0;

    for (int i = 0; i < 150; i++) {
        vec3 p = ro + rd * t;

        // Main Mandelbulb (zoomed in/out with progress)
        float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));
        float mb = sdMandelbulb(p * scale) / scale;

        // Universe particles
        float upFloat = mix(1e10, universeParticle(p, uTime), smoothstep(0.6, 0.9, uProgress));

        float d = min(mb, upFloat);

        if (d < 0.0005) { matID = (d == mb) ? 1.0 : 2.0; break; }
        if (t > 20.0) break;
        t += clamp(d * 0.5, 0.0002, 0.1);
    }
    return vec2(t, matID);
}

vec3 calcNormal6(vec3 p) {
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));
    const float e = 0.001;
    return normalize(vec3(
        sdMandelbulb((p+vec3(e,0,0))*scale) - sdMandelbulb((p-vec3(e,0,0))*scale),
        sdMandelbulb((p+vec3(0,e,0))*scale) - sdMandelbulb((p-vec3(0,e,0))*scale),
        sdMandelbulb((p+vec3(0,0,e))*scale) - sdMandelbulb((p-vec3(0,0,e))*scale)));
}

void main() {
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // Camera: zooms OUT dramatically (the holy-shit moment)
    // progress 0..0.5: zoom in close to Mandelbulb surface
    // progress 0.5..1: zoom out to reveal the entire universe is a particle
    float zoomPhase = smoothstep(0.4, 0.9, uProgress);
    float camDist = mix(0.8, 6.0, zoomPhase);
    float camAngle = uTime * 0.12;
    vec3 ro = vec3(
        sin(camAngle) * camDist,
        cos(camAngle * 0.7) * camDist * 0.4 + 0.2,
        cos(camAngle) * camDist);

    // Non-euclidean warp at transition
    if (uProgress > 0.5) {
        float warpAmt = smoothstep(0.5, 0.8, uProgress);
        ro = mix(ro, nonEuclideanPos(ro, uTime), warpAmt * 0.3);
    }

    vec3 target = vec3(0.0);
    vec3 fwd   = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up    = cross(right, fwd);
    float fov  = radians(mix(50.0, 80.0, zoomPhase));
    vec3 rd    = normalize(fwd + ndc.x * right * tan(fov*0.5) + ndc.y * up * tan(fov*0.5));

    // Background: deep cosmic void with star field
    float starNoise = pow(hash12(vUV * 500.0), 20.0);
    vec3 starField = vec3(starNoise * 2.0);
    vec3 nebulaCol = mix(vec3(0.05, 0.0, 0.1), vec3(0.0, 0.05, 0.15),
                        fbm2(vUV * 3.0, 4, 2.0, 0.5));
    vec3 col = nebulaCol + starField;

    // Portal warp (glimpse of another universe through wormhole)
    float portalStrength = smoothstep(0.2, 0.6, uProgress);
    vec2 warpedUV = portalUV(vUV, vec2(0.5), 0.25, portalStrength * 2.0);

    // Raymarch
    vec2 hit = rayMarch6(ro, rd);
    float t = hit.x, matID = hit.y;

    if (matID > 0.0 && t < 20.0) {
        vec3 pos = ro + rd * t;
        vec3 N   = calcNormal6(pos);
        vec3 V   = -rd;

        if (matID < 1.5) {
            // Mandelbulb surface — orbit trap coloring
            vec4 trap = mandelbulbColor(pos * mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)));

            // Exotic surface colors based on trap values
            vec3 c1 = vec3(0.5, 0.1, 1.0);   // violet
            vec3 c2 = vec3(0.0, 0.8, 1.0);   // cyan
            vec3 c3 = vec3(1.0, 0.3, 0.0);   // orange
            vec3 albedo = mix(mix(c1, c2, trap.x), c3, trap.w * 0.3);
            albedo = clamp(albedo, 0.0, 1.0);

            float metallic  = 0.8;
            float roughness = mix(0.1, 0.5, trap.z);

            // Three lights from different angles
            vec3 L1 = normalize(vec3(1.0, 2.0, 1.0));
            vec3 L2 = normalize(vec3(-1.5, 0.5, -1.0));
            vec3 L3 = normalize(vec3(0.0, -1.0, 2.0));

            vec3 sh = cookTorrance(N, V, L1, albedo, metallic, roughness) * vec3(1.5, 1.2, 1.0) * 3.0;
            sh     += cookTorrance(N, V, L2, albedo, metallic, roughness) * vec3(0.3, 0.5, 1.5) * 2.0;
            sh     += cookTorrance(N, V, L3, albedo, metallic, roughness) * vec3(1.0, 0.3, 0.5) * 1.5;

            vec3 env = envLighting(N, V, albedo, metallic, roughness,
                                   vec3(0.1, 0.05, 0.2), vec3(0.02, 0.0, 0.05));

            // Subsurface glow (the fractal breathes)
            float breathe = sin(uTime * 2.0) * 0.5 + 0.5;
            vec3 emission = albedo * breathe * 0.3;

            col = sh + env * 0.4 + emission;

            // Interior glow (fractal depth shining through)
            float depth = exp(-trap.w * 5.0);
            col += vec3(0.3, 0.8, 1.0) * depth * 0.5;
        }
        else {
            // Universe particles — tiny bright points
            vec3 particleColor = vec3(
                sin(pos.x * 10.0 + uTime) * 0.5 + 0.5,
                cos(pos.y * 13.0 + uTime) * 0.5 + 0.5,
                sin(pos.z * 7.0  + uTime) * 0.5 + 0.5);
            col = particleColor * 5.0;
        }

        // Fog: cosmic haze
        float fog = 1.0 - exp(-t * 0.15);
        col = mix(col, nebulaCol * 2.0, fog * 0.5);
    }

    // HOLY-SHIT overlay: zoom-out reveal text "YOU WERE A PARTICLE ALL ALONG"
    // (implemented as bright flash + scale shift)
    if (uProgress > 0.6) {
        float reveal = smoothstep(0.6, 0.85, uProgress);
        float edge = 1.0 - smoothstep(0.44, 0.5, abs(length(vUV - 0.5) - 0.5 * reveal));
        col += vec3(0.5, 0.8, 1.0) * edge * reveal * 2.0;
    }

    // Beat: supernova pulse
    float beatFlash = pow(1.0 - uBeatPhase, 5.0) * uBeatStrength;
    col += vec3(0.7, 0.4, 1.0) * beatFlash;
    col = mix(col, vec3(1.0, 0.9, 1.0), beatFlash * (uBeatStrength > 0.95 ? 0.4 : 0.0));

    fragColor = vec4(col, 1.0);
}
