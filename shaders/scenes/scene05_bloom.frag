#version 460 core
// SCENE 5: GEOMETRY BLOOM — Mathematical Flowers, Fractal Temples, Ethereal Glow
// Duration: 1:45 - 2:30 (45 seconds)

#include "../common/noise.glsl"
#include "../common/sdf.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;

// -------- Scene SDF --------
// Organic mathematical structures

float sdFlower(vec3 p, float t, float petals) {
    // Rotating flower in XZ plane, extruded in Y
    vec3 q = p;
    q.xz = vec2(cos(t*0.2)*q.x - sin(t*0.2)*q.z, sin(t*0.2)*q.x + cos(t*0.2)*q.z);

    float theta = atan(q.z, q.x);
    float r     = length(q.xz);
    float rose  = 0.8 * abs(cos(petals * theta * 0.5));
    float d2d   = r - rose;
    float dYE   = abs(q.y) - 0.15;
    return length(vec2(max(d2d, 0.0), max(dYE, 0.0))) + min(max(d2d, dYE), 0.0) - 0.05;
}

float sdFractalTemple(vec3 p, float t) {
    // Sierpinski-inspired temple structure
    float scale = 2.0;
    vec3 q = p * 0.3;
    for (int i = 0; i < 4; i++) {
        q = abs(q);
        if (q.x < q.y) q.xy = q.yx;
        if (q.x < q.z) q.xz = q.zx;
        if (q.y < q.z) q.yz = q.zy;
        q = q * scale - (scale - 1.0) * 0.5;
    }
    return length(q) / pow(scale, 4.0) - 0.01;
}

vec2 sdScene5(vec3 p) {
    float growPhase = uProgress;

    // Central flower (grows in with progress)
    float flowerScale = smoothstep(0.0, 0.4, growPhase);
    vec3 fp = p / max(flowerScale, 0.01);
    float flower1 = sdFlower(fp, uTime, 5.0) * flowerScale - 0.0;
    flower1 = max(flower1, -sdSphere(p, 1.8));  // clip to sphere

    // Surrounding secondary flowers
    float flowers = flower1;
    for (int i = 0; i < 6; i++) {
        float ang = float(i) * 3.14159 / 3.0 + uTime * 0.05;
        float r = 2.5 + sin(uTime * 0.3 + float(i)) * 0.3;
        float appear = smoothstep(0.1 + float(i) * 0.05, 0.3 + float(i) * 0.05, growPhase);
        vec3 fpos = p - vec3(cos(ang) * r, 0.0, sin(ang) * r);
        float fi = sdFlower(fpos * 0.6, uTime + float(i), 3.0 + float(i)) / 0.6;
        fi *= appear;
        flowers = smin(flowers, fi, 0.3);
    }

    // Fractal temple appearing later
    float templeAppear = smoothstep(0.4, 0.8, growPhase);
    float temple = sdFractalTemple(p, uTime) * templeAppear;

    // Ground with organic undulation
    float ground = p.y + 4.0 + fbm3(p * 0.5 + uTime * 0.05, 4, 2.0, 0.5) * 0.5;

    // Combine
    vec2 res = sminMat(vec2(flowers, 1.0), vec2(temple, 2.0), 0.5);
    res = sminMat(res, vec2(ground, 3.0), 0.5);
    return res;
}

float calcAO_local5(vec3 pos, vec3 nor) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12*float(i)/4.0;
        float d = sdScene5(pos + h*nor).x;
        occ += (h - d)*sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0*occ, 0.0, 1.0);
}

vec3 calcNormal5(vec3 p) {
    const float e = 0.002;
    return normalize(vec3(
        sdScene5(p+vec3(e,0,0)).x - sdScene5(p-vec3(e,0,0)).x,
        sdScene5(p+vec3(0,e,0)).x - sdScene5(p-vec3(0,e,0)).x,
        sdScene5(p+vec3(0,0,e)).x - sdScene5(p-vec3(0,0,e)).x));
}

// -------- Volumetric scattering (ethereal glow) --------
vec3 volumetricScatter(vec3 ro, vec3 rd, int steps) {
    vec3 scatter = vec3(0.0);
    float t = 0.1;
    float stepSize = 8.0 / float(steps);

    for (int i = 0; i < steps; i++) {
        vec3 p = ro + rd * t;
        float d = sdScene5(p).x;

        // Light emission from nearby surfaces
        float nearSurface = exp(-max(d, 0.0) * 3.0);

        // FBM volumetric density
        float density = domainWarpFbm(p * 0.5 + uTime * 0.05, 3) * nearSurface;

        // Color gradient: cyan → magenta → gold
        float colorPhase = (p.y + 4.0) / 8.0 + uProgress * 0.3;
        vec3 bloom1 = vec3(0.2, 1.0, 0.8);
        vec3 bloom2 = vec3(1.0, 0.2, 0.8);
        vec3 bloom3 = vec3(1.0, 0.8, 0.2);
        vec3 volColor = mix(mix(bloom1, bloom2, fract(colorPhase)),
                           bloom3, fract(colorPhase + 0.5));

        scatter += volColor * density * stepSize * 0.15;
        t += stepSize;
    }
    return scatter;
}

void main() {
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // Camera: slow orbit, tilting upward
    float camAng = uTime * 0.08 + uProgress * 0.5;
    float camHeight = mix(-1.0, 3.0, uProgress);
    float camDist   = mix(8.0, 5.0, uProgress);
    vec3  ro = vec3(sin(camAng) * camDist, camHeight, cos(camAng) * camDist);
    vec3  target = vec3(0.0, 0.5, 0.0);

    vec3 fwd   = normalize(target - ro);
    vec3 right = normalize(cross(fwd, vec3(0,1,0)));
    vec3 up    = cross(right, fwd);
    float fov  = radians(65.0);
    vec3 rd    = normalize(fwd + ndc.x * right * tan(fov*0.5) + ndc.y * up * tan(fov*0.5));

    // Sky: deep twilight, gradient
    float h = rd.y * 0.5 + 0.5;
    vec3 col = mix(vec3(0.02, 0.01, 0.05), vec3(0.05, 0.02, 0.1), h);

    // Raymarch
    float t = 0.1, matID = 0.0;
    for (int i = 0; i < 120; i++) {
        vec2 hit = sdScene5(ro + rd * t);
        if (hit.x < 0.001) { matID = hit.y; break; }
        if (t > 40.0) break;
        t += hit.x * 0.85;
    }

    if (matID > 0.0 && t < 40.0) {
        vec3 pos = ro + rd * t;
        vec3 N   = calcNormal5(pos);
        vec3 V   = -rd;

        // Light setup: three colored point lights (like stained glass)
        vec3 L1 = normalize(vec3(sin(uTime*0.5)*3.0, 4.0, cos(uTime*0.5)*3.0));
        vec3 L2 = normalize(vec3(-2.0, 2.0, 1.0));
        vec3 L3 = normalize(vec3(0.0, -1.0, 0.0));  // under-glow

        vec3 lightC1 = vec3(0.3, 1.0, 0.8) * 3.0;
        vec3 lightC2 = vec3(1.0, 0.3, 0.8) * 2.0;
        vec3 lightC3 = vec3(0.8, 0.5, 0.0) * 1.5;

        if (matID < 1.5) {
            // Flower: iridescent bioluminescent material
            float colorAng = atan(pos.z, pos.x) + uTime * 0.1;
            vec3 petalHue = vec3(
                sin(colorAng * 3.0) * 0.5 + 0.5,
                cos(colorAng * 2.0) * 0.5 + 0.5,
                sin(colorAng * 5.0 + 1.0) * 0.5 + 0.5);

            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
            vec3 albedo   = mix(vec3(0.05), petalHue * 0.8, 0.7);
            float r = 0.2, m = 0.3;

            vec3 sh = cookTorrance(N, V, L1, albedo, m, r) * lightC1;
            sh     += cookTorrance(N, V, L2, albedo, m, r) * lightC2;
            // Self-emission (bioluminescent glow)
            vec3 emission = petalHue * (0.5 + fresnel * 2.0) * 2.0;
            col = sh + emission;
        }
        else if (matID < 2.5) {
            // Temple: sacred stone with golden veins
            float vein = domainWarpFbm(pos * 3.0, 4);
            vec3 stone  = mix(vec3(0.2, 0.15, 0.1), vec3(0.4, 0.3, 0.2), vein);
            vec3 gold   = vec3(1.0, 0.7, 0.1);
            vec3 albedo = mix(stone, gold, step(0.7, vein));

            float m = mix(0.1, 0.9, step(0.7, vein));
            float r = mix(0.7, 0.2, step(0.7, vein));

            vec3 sh = cookTorrance(N, V, L1, albedo, m, r) * lightC1
                    + cookTorrance(N, V, L2, albedo, m, r) * lightC2
                    + cookTorrance(N, V, L3, albedo, m, r) * lightC3;
            vec3 env = envLighting(N, V, albedo, m, r,
                                   vec3(0.1, 0.05, 0.2), vec3(0.05, 0.02, 0.1));
            col = sh + env * 0.5;
        }
        else {
            // Ground
            float groundPattern = fbm3(pos * 0.3, 4, 2.0, 0.5);
            vec3 albedo = mix(vec3(0.08, 0.05, 0.12), vec3(0.15, 0.08, 0.2), groundPattern);
            vec3 sh = cookTorrance(N, V, L1, albedo, 0.0, 0.8) * lightC1;
            float glowLines = smoothstep(0.05, 0.0, abs(fract(pos.x * 0.5) - 0.5) - 0.4);
            glowLines += smoothstep(0.05, 0.0, abs(fract(pos.z * 0.5) - 0.5) - 0.4);
            col = sh + vec3(0.2, 0.5, 0.8) * glowLines * 0.3;
        }

        // AO
        float ao = calcAO_local5(pos, N);
        col *= mix(0.5, 1.0, ao);

        // Fog
        float fog = 1.0 - exp(-t * 0.03);
        col = mix(col, vec3(0.02, 0.01, 0.05), fog);
    }

    // Volumetric scattering (the ethereal glow)
    vec3 vol = volumetricScatter(ro, rd, 20);
    col += vol;

    // Beat pulse: bright flare
    float beatPulse = pow(1.0 - uBeatPhase, 10.0) * uBeatStrength;
    col += vec3(0.4, 0.8, 0.4) * beatPulse * 0.5;

    fragColor = vec4(col, 1.0);
}
