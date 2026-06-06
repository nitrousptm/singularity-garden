#version 460 core
// SCENE 6: IMPOSSIBLE SPACE — Recursive Universes, Mandelbulb, THE HOLY-SHIT-MOMENT
// Duration: 2:30 - 3:00 (30 seconds)

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

// ============================================================
// SECTION 1: EXTENDED MATH LIBRARY
// ============================================================

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cdiv(vec2 a, vec2 b) {
    float d = dot(b, b);
    return vec2(dot(a, b), a.y*b.x - a.x*b.y) / max(d, 1e-10);
}

vec2 cpow(vec2 z, float n) {
    float r = length(z);
    float theta = atan(z.y, z.x);
    return pow(r, n) * vec2(cos(n*theta), sin(n*theta));
}

vec2 cexp(vec2 z) {
    return exp(z.x) * vec2(cos(z.y), sin(z.y));
}

vec2 clog(vec2 z) {
    return vec2(log(length(z)), atan(z.y, z.x));
}

vec2 csin(vec2 z) {
    return vec2(sin(z.x)*cosh(z.y), cos(z.x)*sinh(z.y));
}

vec2 ccos(vec2 z) {
    return vec2(cos(z.x)*cosh(z.y), -sin(z.x)*sinh(z.y));
}

vec4 qmul(vec4 a, vec4 b) {
    return vec4(
        a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
        a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
        a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
        a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z
    );
}

vec3 qrot(vec3 v, vec4 q) {
    vec4 qconj = vec4(-q.x, -q.y, -q.z, q.w);
    vec4 vq = vec4(v, 0.0);
    vec4 r = qmul(qmul(q, vq), qconj);
    return r.xyz;
}

vec4 quatFromAxisAngle(vec3 axis, float angle) {
    float s = sin(angle * 0.5);
    return vec4(normalize(axis) * s, cos(angle * 0.5));
}

vec3 cartToSph(vec3 c) {
    float r = length(c);
    float theta = acos(clamp(c.z / max(r, 1e-8), -1.0, 1.0));
    float phi = atan(c.y, c.x);
    return vec3(r, theta, phi);
}

vec3 sphToCart(vec3 s) {
    return s.x * vec3(sin(s.y)*cos(s.z), sin(s.y)*sin(s.z), cos(s.y));
}

mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

mat3 rot3X(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
}

mat3 rot3Y(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}

mat3 rot3Z(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0, s,c,0, 0,0,1);
}

float smoothMax(float a, float b, float k) {
    return log(exp(k*a) + exp(k*b)) / k;
}

float remap01(float v, float lo, float hi) {
    return clamp((v - lo) / (hi - lo), 0.0, 1.0);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ============================================================
// SECTION 2: FRACTAL SDFs
// ============================================================

float sdMandelbulb(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r  = 0.0;
    const int MAX_ITER = 12;
    const float POWER = 8.0;

    for (int i = 0; i < MAX_ITER; i++) {
        r = length(z);
        if (r > 2.0) break;
        float theta  = acos(z.z / r);
        float phi    = atan(z.y, z.x);
        dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;
        float zr = pow(r, POWER);
        theta *= POWER;
        phi   *= POWER;
        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
        z += pos;
    }
    return 0.5 * log(r) * r / dr;
}

float sdMandelbulb6(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    float r  = 0.0;
    const int MAX_ITER = 12;
    const float POWER = 6.0;

    for (int i = 0; i < MAX_ITER; i++) {
        r = length(z);
        if (r > 2.0) break;
        float theta  = acos(clamp(z.z / r, -1.0, 1.0));
        float phi    = atan(z.y, z.x);
        dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;
        float zr = pow(r, POWER);
        theta *= POWER;
        phi   *= POWER;
        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
        z += pos;
    }
    return 0.5 * log(max(r, 1e-8)) * r / max(dr, 1e-8);
}

float sdMandelbox(vec3 pos, float scale) {
    vec3 z = pos;
    float dr = 1.0;
    const int MAX_ITER = 12;

    for (int i = 0; i < MAX_ITER; i++) {
        z = clamp(z, -1.0, 1.0) * 2.0 - z;

        float r2 = dot(z, z);
        if (r2 < 0.25) {
            float factor = 4.0;
            z *= factor;
            dr *= factor;
        } else if (r2 < 1.0) {
            float factor = 1.0 / r2;
            z *= factor;
            dr *= factor;
        }

        z = scale * z + pos;
        dr = dr * abs(scale) + 1.0;
    }

    float r = length(z);
    return r / abs(dr) - pow(abs(scale), float(1 - MAX_ITER));
}

float sdKleinianGroup(vec3 pos) {
    vec3 z = pos;
    float minDist = 1e8;
    const int ITER = 48;

    for (int i = 0; i < ITER; i++) {
        z = abs(z);
        float r2 = dot(z, z);
        z /= max(r2, 0.01);
        z = z * 2.5 - vec3(1.5, 1.0, 0.75);

        if (z.x > z.y) z.xy = z.yx;
        if (z.x > z.z) z.xz = z.zx;
        if (z.y > z.z) z.yz = z.zy;

        minDist = min(minDist, length(z - vec3(0.5, 0.3, 0.8)));
    }
    return minDist * 0.015;
}

float sdSierpinskiTetrahedron(vec3 pos, int iters) {
    vec3 a1 = vec3( 1.0,  1.0,  1.0);
    vec3 a2 = vec3(-1.0, -1.0,  1.0);
    vec3 a3 = vec3( 1.0, -1.0, -1.0);
    vec3 a4 = vec3(-1.0,  1.0, -1.0);

    vec3 z = pos;
    float scale = 1.0;

    for (int i = 0; i < iters; i++) {
        float d1 = length(z - a1);
        float d2 = length(z - a2);
        float d3 = length(z - a3);
        float d4 = length(z - a4);

        vec3 closest = a1;
        float dMin = d1;
        if (d2 < dMin) { dMin = d2; closest = a2; }
        if (d3 < dMin) { dMin = d3; closest = a3; }
        if (d4 < dMin) { dMin = d4; closest = a4; }

        z = z * 2.0 - closest;
        scale *= 2.0;
    }

    return (length(z) - 2.0) / scale;
}

vec4 mandelbulbOrbitTrap(vec3 pos) {
    vec3 z = pos;
    float r = 0.0;
    vec4 trap = vec4(1e8);
    const float POWER = 8.0;

    for (int i = 0; i < 12; i++) {
        r = length(z);
        if (r > 2.0) break;
        trap = min(trap, vec4(abs(z.x), abs(z.y), abs(z.z), dot(z,z)));

        float theta = acos(clamp(z.z/r, -1.0, 1.0)) * POWER;
        float phi   = atan(z.y, z.x) * POWER;
        float zr    = pow(r, POWER);
        z = zr * vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta)) + pos;
    }
    return trap;
}

vec4 mandelboxColor(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;
    const float scale = 2.8;
    vec4 trap = vec4(1e8);

    for (int i = 0; i < 12; i++) {
        z = clamp(z, -1.0, 1.0) * 2.0 - z;
        float r2 = dot(z, z);
        trap = min(trap, vec4(abs(z.x), abs(z.y), abs(z.z), r2));
        if (r2 < 0.25) { z *= 4.0; dr *= 4.0; }
        else if (r2 < 1.0) { z /= r2; dr /= r2; }
        z = scale * z + pos;
        dr = dr * abs(scale) + 1.0;
    }
    return trap;
}

// ============================================================
// SECTION 3: NON-EUCLIDEAN SPACE
// ============================================================

vec3 nonEuclideanPos(vec3 p, float t) {
    float r = length(p);
    float theta = atan(p.y, p.x) + t * 0.1;
    float phi   = acos(clamp(p.z / max(r, 0.001), -1.0, 1.0)) + t * 0.07;
    float proj = 1.0 + r * r;
    return vec3(2.0*p.x/proj, 2.0*p.y/proj, (r*r-1.0)/proj) * 3.0;
}

vec3 hyperbolicSpace(vec3 p, float curvature) {
    float r = length(p);
    float rClamped = clamp(r, 0.0, 1.0 / sqrt(abs(curvature)) - 0.001);
    float kr2 = curvature * rClamped * rClamped;
    float factor = 2.0 / (1.0 - kr2);
    vec3 result = p * (factor / max(r, 1e-6)) * rClamped;
    return result;
}

vec3 sphericalGeometry(vec3 p, float radius) {
    float r = length(p);
    float angle = r / radius;
    if (r < 1e-6) return p;
    return (sin(angle) / (r / radius)) * p;
}

vec3 torusTopology(vec3 p, float t) {
    float wrapX = 2.0 * PI;
    float wrapY = 2.0 * PI;
    float wrapZ = 4.0;

    float u = mod(p.x / wrapX + t * 0.05, 1.0) * wrapX;
    float v = mod(p.y / wrapY + t * 0.03, 1.0) * wrapY;
    float w = mod(p.z / wrapZ, 1.0) * wrapZ;

    float majorR = 2.0;
    float minorR = 0.8;

    vec3 torusP;
    torusP.x = (majorR + minorR * cos(v)) * cos(u);
    torusP.y = (majorR + minorR * cos(v)) * sin(u);
    torusP.z = minorR * sin(v);

    return mix(p, torusP + vec3(0.0, 0.0, w - 2.0), 0.5);
}

vec3 kleinBottle(vec3 p, float t) {
    float u = atan(p.y, p.x) + t * 0.08;
    float v = length(p.xy) + p.z * 0.5 + t * 0.05;
    float r = length(p);

    float kx = (2.0 + cos(v*0.5) * sin(u) - sin(v*0.5) * sin(2.0*u)) * cos(v);
    float ky = (2.0 + cos(v*0.5) * sin(u) - sin(v*0.5) * sin(2.0*u)) * sin(v);
    float kz = sin(v*0.5) * sin(u) + cos(v*0.5) * sin(2.0*u);

    return mix(p, vec3(kx, ky, kz) * 0.3, smoothstep(0.3, 0.8, uProgress) * 0.4);
}

// ============================================================
// SECTION 4: PORTAL SYSTEM
// ============================================================

vec2 portalUV(vec2 uv, vec2 center, float radius, float strength) {
    vec2 delta = uv - center;
    float dist = length(delta);
    if (dist < radius) {
        float warp = (1.0 - dist/radius);
        delta *= 1.0 + warp * warp * strength;
    }
    return center + delta;
}

vec3 portalField(vec3 p, vec3 center, float radius) {
    vec3 d = p - center;
    float r = length(d);
    if (r < 1e-6) return p;
    float warp = exp(-r / radius) * 2.0;
    vec3 dir = normalize(d);
    return p - dir * warp * radius * 0.3;
}

float wormholeMetric(vec3 p, float throat, float t) {
    float rho = length(p.xy);
    float l = p.z;
    float bSquare = throat * throat;
    float r = sqrt(rho*rho + bSquare);

    float warp = sin(t * 0.5) * 0.15;
    return r - throat + abs(l) * 0.1 + warp;
}

vec3 recursivePortal(vec3 p, float t, int depth) {
    vec3 result = p;
    float scale = 1.0;

    for (int i = 0; i < depth; i++) {
        float r = length(result);
        if (r < 0.3 * scale) {
            vec4 q = quatFromAxisAngle(vec3(sin(t*0.3+float(i)), cos(t*0.2), sin(t*0.1)), t * 0.5 + float(i) * 1.2);
            result = qrot(result / (scale * 0.3), q) * scale * 0.3 * 2.5;
        }
        scale *= 0.4;
    }

    return result;
}

vec3 renderPortalRing(vec2 uv, vec2 center, float radius, float t) {
    vec2 d = uv - center;
    float r = length(d);
    float ring = abs(r - radius);
    float thickness = 0.008 + sin(t * 3.0) * 0.003;
    float glow = exp(-ring / thickness) * 2.5;

    float angle = atan(d.y, d.x);
    float spin = sin(angle * 6.0 + t * 2.0) * 0.5 + 0.5;
    float pulse = sin(t * 4.0) * 0.5 + 0.5;

    vec3 c1 = vec3(0.3, 0.7, 1.0);
    vec3 c2 = vec3(0.9, 0.3, 1.0);
    vec3 ringColor = mix(c1, c2, spin) * glow * (0.7 + pulse * 0.3);

    float innerGlow = exp(-r / (radius * 0.8)) * 0.15;
    ringColor += vec3(0.5, 0.8, 1.0) * innerGlow;

    float outerGlow = exp(-(r - radius) / (radius * 0.4)) * step(radius, r) * 0.5;
    ringColor += vec3(0.2, 0.4, 0.9) * outerGlow;

    return ringColor;
}

// ============================================================
// SECTION 5: UNIVERSE-IN-PARTICLE (3-LEVEL RECURSION)
// ============================================================

float universeParticle(vec3 p, float t) {
    float result = 1e8;

    // Level 1: macro universe cells
    vec3 q1 = mod(p * 4.0 + t * 0.15, 4.0) - 2.0;
    vec4 rot1q = quatFromAxisAngle(vec3(0.577), t * 0.3);
    vec3 rq1 = qrot(q1, rot1q);
    float mb1 = sdMandelbulb(rq1 * 0.7) / 0.7;
    float shell1 = sdSphere(q1, 0.35);
    float uni1 = max(shell1, -mb1 - 0.02);
    result = min(result, uni1);

    // Level 2: meso universe cells
    vec3 q2 = mod(p * 16.0 + t * 0.35, 4.0) - 2.0;
    vec4 rot2q = quatFromAxisAngle(vec3(0.0, 1.0, 0.0), t * 0.55 + hash13(floor(p*4.0)) * 6.28);
    vec3 rq2 = qrot(q2, rot2q);
    float mb2 = sdMandelbulb6(rq2 * 0.65) / 0.65;
    float shell2 = sdSphere(q2, 0.25);
    float uni2 = max(shell2, -mb2 - 0.015);
    result = min(result, uni2 * 0.25);

    // Level 3: micro universe cells
    vec3 q3 = mod(p * 64.0 + t * 0.7, 4.0) - 2.0;
    vec4 rot3q = quatFromAxisAngle(
        normalize(vec3(cos(t*0.4), sin(t*0.3), cos(t*0.5))),
        t * 1.1 + hash13(floor(p*16.0)) * 6.28
    );
    vec3 rq3 = qrot(q3, rot3q);
    float mb3 = sdMandelbulb(rq3 * 0.6) / 0.6;
    float shell3 = sdSphere(q3, 0.18);
    float uni3 = max(shell3, -mb3 - 0.01);
    result = min(result, uni3 * 0.0625);

    return result;
}

// ============================================================
// SECTION 6: EXTENDED RAYMARCHER
// ============================================================

vec3 rayMarch6(vec3 ro, vec3 rd) {
    float t = 0.001;
    float matID = 0.0;
    float stepCount = 0.0;

    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));
    float mandelboxAmt = smoothstep(0.15, 0.45, uProgress);
    float sierpAmt     = smoothstep(0.35, 0.6, uProgress);
    float kleinAmt     = smoothstep(0.55, 0.8, uProgress);
    float uniAmt       = smoothstep(0.6,  0.9, uProgress);

    for (int i = 0; i < 200; i++) {
        stepCount = float(i);
        vec3 p = ro + rd * t;

        float mb = sdMandelbulb(p * scale) / scale;

        float mbox = 1e10;
        if (mandelboxAmt > 0.01) {
            vec3 mbp = p * (scale * 0.6);
            mbox = sdMandelbox(mbp, 2.8) / (scale * 0.6);
            mbox = mix(1e10, mbox, mandelboxAmt);
        }

        float sierk = 1e10;
        if (sierpAmt > 0.01) {
            vec3 sp = p * scale * 1.2;
            sierk = sdSierpinskiTetrahedron(sp, 8) / (scale * 1.2);
            sierk = mix(1e10, sierk, sierpAmt);
        }

        float klein = 1e10;
        if (kleinAmt > 0.01) {
            vec3 kp = kleinBottle(p * scale * 0.8, uTime) / (scale * 0.8);
            klein = sdKleinianGroup(kp);
            klein = mix(1e10, klein, kleinAmt);
        }

        float upFloat = 1e10;
        if (uniAmt > 0.01) {
            upFloat = universeParticle(p, uTime);
            upFloat = mix(1e10, upFloat, uniAmt);
        }

        float d = mb;
        matID = 1.0;

        if (mbox < d) { d = mbox; matID = 2.0; }
        if (sierk < d) { d = sierk; matID = 3.0; }
        if (klein < d) { d = klein; matID = 4.0; }
        if (upFloat < d) { d = upFloat; matID = 5.0; }

        if (d < 0.0004) break;
        if (t > 25.0) { matID = 0.0; break; }
        t += clamp(d * 0.45, 0.00015, 0.12);
    }

    return vec3(t, matID, stepCount);
}

vec3 calcNormal6(vec3 p) {
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));
    const float e = 0.0008;
    vec3 ep = vec3(e, 0.0, 0.0);
    return normalize(vec3(
        sdMandelbulb((p + ep.xyy)*scale) - sdMandelbulb((p - ep.xyy)*scale),
        sdMandelbulb((p + ep.yxy)*scale) - sdMandelbulb((p - ep.yxy)*scale),
        sdMandelbulb((p + ep.yyx)*scale) - sdMandelbulb((p - ep.yyx)*scale)
    ));
}

vec3 calcNormal6Mandelbox(vec3 p) {
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)) * 0.6;
    const float e = 0.001;
    vec3 ep = vec3(e, 0.0, 0.0);
    return normalize(vec3(
        sdMandelbox((p + ep.xyy)*scale, 2.8) - sdMandelbox((p - ep.xyy)*scale, 2.8),
        sdMandelbox((p + ep.yxy)*scale, 2.8) - sdMandelbox((p - ep.yxy)*scale, 2.8),
        sdMandelbox((p + ep.yyx)*scale, 2.8) - sdMandelbox((p - ep.yyx)*scale, 2.8)
    ));
}

vec3 calcNormalSierpinski(vec3 p) {
    float s = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)) * 1.2;
    const float e = 0.001;
    vec3 ep = vec3(e, 0.0, 0.0);
    return normalize(vec3(
        sdSierpinskiTetrahedron((p + ep.xyy)*s, 8) - sdSierpinskiTetrahedron((p - ep.xyy)*s, 8),
        sdSierpinskiTetrahedron((p + ep.yxy)*s, 8) - sdSierpinskiTetrahedron((p - ep.yxy)*s, 8),
        sdSierpinskiTetrahedron((p + ep.yyx)*s, 8) - sdSierpinskiTetrahedron((p - ep.yyx)*s, 8)
    ));
}

float calcAO6(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));

    for (int i = 0; i < 5; i++) {
        float hr = 0.01 + 0.12 * float(i) / 4.0;
        vec3 aoPos = nor * hr + pos;
        float dd = sdMandelbulb(aoPos * scale) / scale;
        occ += (hr - dd) * sca;
        sca *= 0.95;
    }

    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// ============================================================
// SECTION 7: FRACTAL ATMOSPHERE
// ============================================================

vec3 fractalFog(vec3 ro, vec3 rd, float tHit, float t) {
    float stepSize = tHit / 48.0;
    vec3 fogColor = vec3(0.0);
    float transmittance = 1.0;
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));

    for (int i = 0; i < 48; i++) {
        float ti = (float(i) + 0.5) * stepSize;
        vec3 p = ro + rd * ti;

        float d = sdMandelbulb(p * scale) / scale;
        float density = exp(-max(d, 0.0) * 8.0) * 0.04;

        vec3 fc1 = vec3(0.2, 0.05, 0.35);
        vec3 fc2 = vec3(0.0, 0.2, 0.4);
        float n = fbm3(p + vec3(0.0, 0.0, t * 0.1), 3, 2.0, 0.5) * 0.5 + 0.5;
        vec3 localColor = mix(fc1, fc2, n);

        float emission = max(-d, 0.0) * 3.0;
        localColor += vec3(0.4, 0.7, 1.0) * emission;

        float beat = uBeatStrength * exp(-uBeatPhase * 4.0);
        localColor += vec3(0.6, 0.2, 0.9) * beat * density * 5.0;

        fogColor += localColor * density * transmittance;
        transmittance *= exp(-density);

        if (transmittance < 0.01) break;
    }

    return fogColor;
}

float fractalDust(vec3 p, float t) {
    float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress));
    float d = sdMandelbulb(p * scale) / scale;

    float gap = smoothstep(0.0, 0.5, d);
    float n = fbm3(p * 3.0 + vec3(t * 0.05), 4, 2.0, 0.5);
    float dust = gap * n * n;

    float vorD = voronoi2(p.xy * 5.0 + t * 0.1).x;
    dust *= smoothstep(0.4, 0.0, vorD);

    return clamp(dust * 0.5, 0.0, 1.0);
}

vec3 nebulaBackground(vec2 uv, vec3 rd, float t) {
    vec3 base = vec3(0.01, 0.0, 0.03);

    vec2 sphereUV = vec2(atan(rd.z, rd.x) / (2.0*PI), asin(rd.y) / PI) * 0.5 + 0.5;

    float n1 = fbm2(sphereUV * 4.0 + vec2(t * 0.01, 0.0), 6, 2.0, 0.5);
    float n2 = fbm2(sphereUV * 7.0 + vec2(0.0, t * 0.007), 5, 2.2, 0.45);
    float n3 = fbm2(sphereUV * 13.0 + vec2(t * 0.015), 4, 2.0, 0.5);

    vec3 neb1 = vec3(0.15, 0.02, 0.35) * pow(max(n1, 0.0), 2.0) * 2.5;
    vec3 neb2 = vec3(0.0, 0.12, 0.3) * pow(max(n2, 0.0), 2.2) * 2.0;
    vec3 neb3 = vec3(0.3, 0.1, 0.0) * pow(max(n3, 0.0), 3.0) * 1.5;

    base += neb1 + neb2 + neb3;

    float starHash1 = hash12(uv * 800.0 + vec2(0.5));
    float starHash2 = hash12(uv * 1600.0 + vec2(1.3, 2.7));
    float starHash3 = hash12(uv * 3200.0 + vec2(3.1, 0.9));

    float star1 = pow(starHash1, 22.0) * 4.0;
    float star2 = pow(starHash2, 28.0) * 6.0;
    float star3 = pow(starHash3, 35.0) * 8.0;

    float twinkle1 = sin(uTime * 2.3 + hash12(uv * 400.0) * 6.28) * 0.3 + 0.7;
    float twinkle2 = sin(uTime * 1.7 + hash12(uv * 450.0) * 6.28) * 0.3 + 0.7;

    vec3 starColor1 = vec3(0.85, 0.9, 1.0) * star1 * twinkle1;
    vec3 starColor2 = vec3(1.0, 0.95, 0.7) * star2 * twinkle2;
    vec3 starColor3 = vec3(0.7, 0.85, 1.0) * star3;

    base += starColor1 + starColor2 + starColor3;

    vec2 milky = sphereUV - vec2(0.5);
    float mw = exp(-abs(milky.y) * 8.0) * exp(-length(milky) * 2.0);
    mw *= fbm2(sphereUV * 20.0, 3, 2.0, 0.5) * 0.5 + 0.5;
    base += vec3(0.12, 0.09, 0.18) * mw * 0.4;

    return base;
}

// ============================================================
// SECTION 8: LIGHTING AND COLORING
// ============================================================

vec3 mandelbulbShading(vec3 pos, vec3 N, vec3 V, float t, vec4 trap, float progress) {
    vec3 c1 = vec3(0.45, 0.05, 0.95);
    vec3 c2 = vec3(0.0, 0.75, 1.0);
    vec3 c3 = vec3(1.0, 0.35, 0.05);
    vec3 c4 = vec3(0.0, 1.0, 0.5);

    vec3 albedo = c1;
    albedo = mix(albedo, c2, clamp(trap.x, 0.0, 1.0));
    albedo = mix(albedo, c3, clamp(trap.w * 0.4, 0.0, 1.0));
    albedo = mix(albedo, c4, clamp(trap.y * trap.z, 0.0, 1.0) * 0.3);
    albedo = clamp(albedo, 0.0, 1.0);

    float metallic  = mix(0.7, 0.95, trap.z);
    float roughness = mix(0.05, 0.45, trap.x * 0.5 + trap.y * 0.3 + trap.z * 0.2);

    vec3 L1 = normalize(vec3(1.0, 2.0, 1.0));
    vec3 L2 = normalize(vec3(-1.5, 0.5, -1.0));
    vec3 L3 = normalize(vec3(0.0, -1.0, 2.0));
    vec3 L4 = normalize(vec3(0.5, -0.5, -0.5));

    vec3 col1 = vec3(1.5, 1.2, 1.0) * 3.5;
    vec3 col2 = vec3(0.3, 0.5, 1.5) * 2.5;
    vec3 col3 = vec3(1.0, 0.3, 0.5) * 2.0;
    vec3 col4 = vec3(0.5, 1.0, 0.3) * 1.5;

    vec3 sh = cookTorrance(N, V, L1, albedo, metallic, roughness) * col1;
    sh     += cookTorrance(N, V, L2, albedo, metallic, roughness) * col2;
    sh     += cookTorrance(N, V, L3, albedo, metallic, roughness) * col3;
    sh     += cookTorrance(N, V, L4, albedo, metallic, roughness) * col4;

    vec3 skyColor    = mix(vec3(0.05, 0.02, 0.15), vec3(0.1, 0.05, 0.25), progress);
    vec3 groundColor = mix(vec3(0.01, 0.0, 0.04), vec3(0.02, 0.01, 0.08), progress);
    vec3 env = envLighting(N, V, albedo, metallic, roughness, skyColor, groundColor);

    float breathe = sin(t * 1.8 + trap.x * 3.14) * 0.4 + 0.6;
    float innerGlow = exp(-trap.w * 6.0);
    vec3 emission = albedo * breathe * 0.25;
    emission += vec3(0.2, 0.6, 1.0) * innerGlow * 0.6;

    float holyShit = smoothstep(0.55, 0.85, progress);
    emission += vec3(1.0, 0.8, 0.4) * holyShit * 0.5 * innerGlow;

    float beat = uBeatStrength * exp(-uBeatPhase * 3.0);
    emission += vec3(0.7, 0.3, 1.0) * beat * 0.8;

    return sh + env * 0.5 + emission;
}

vec3 mandelboxShading(vec3 pos, vec3 N, vec3 V, float t, vec4 trap) {
    float h = fract(trap.x * 0.8 + trap.y * 0.3 + t * 0.05);
    float s = 0.7 + trap.z * 0.3;
    float bv = 0.5 + trap.w * 0.3;
    vec3 albedo = hsv2rgb(vec3(h, s, bv));

    float metallic  = 0.6;
    float roughness = 0.2 + trap.x * 0.3;

    vec3 L1 = normalize(vec3(1.2, 1.5, 0.8));
    vec3 L2 = normalize(vec3(-0.8, 0.3, -1.2));
    vec3 L3 = normalize(vec3(0.1, -1.2, 0.6));

    vec3 sh = cookTorrance(N, V, L1, albedo, metallic, roughness) * vec3(1.3, 1.1, 0.9) * 3.0;
    sh     += cookTorrance(N, V, L2, albedo, metallic, roughness) * vec3(0.4, 0.6, 1.4) * 2.0;
    sh     += cookTorrance(N, V, L3, albedo, metallic, roughness) * vec3(0.8, 0.3, 0.4) * 1.5;

    vec3 env = envLighting(N, V, albedo, metallic, roughness,
                           vec3(0.08, 0.04, 0.18), vec3(0.02, 0.01, 0.05));

    float emit = exp(-trap.w * 4.0) * 0.4;
    vec3 emission = albedo * emit + vec3(0.3, 0.7, 1.0) * emit * 0.5;

    return sh + env * 0.4 + emission;
}

vec3 sierpinskiShading(vec3 pos, vec3 N, vec3 V, float t) {
    float face = dot(N, normalize(vec3(1.0, 1.0, 1.0)));
    vec3 purple = vec3(0.5, 0.0, 0.8);
    vec3 silver = vec3(0.7, 0.7, 0.8);
    vec3 albedo = mix(purple, silver, face * 0.5 + 0.5);

    float metallic  = 0.95;
    float roughness = 0.08;

    vec3 L1 = normalize(vec3(0.8, 1.8, 1.0));
    vec3 L2 = normalize(vec3(-1.2, 0.3, -0.8));

    vec3 sh = cookTorrance(N, V, L1, albedo, metallic, roughness) * vec3(1.0, 0.9, 1.3) * 4.0;
    sh     += cookTorrance(N, V, L2, albedo, metallic, roughness) * vec3(0.5, 0.4, 1.0) * 2.5;

    vec3 env = envLighting(N, V, albedo, metallic, roughness,
                           vec3(0.1, 0.05, 0.2), vec3(0.02, 0.0, 0.06));

    float pulse = sin(t * 2.5) * 0.5 + 0.5;
    vec3 emission = purple * pulse * 0.2;

    return sh + env * 0.5 + emission;
}

vec3 kleinBottleShading(vec3 pos, vec3 N, vec3 V, float t) {
    float angle = atan(pos.y, pos.x) / (2.0 * PI) + 0.5;
    float bend  = dot(N, V);

    float h1 = fract(angle + t * 0.08);
    float h2 = fract(angle + 0.33 + t * 0.06);
    float h3 = fract(angle + 0.67 + t * 0.04);

    vec3 iridA = hsv2rgb(vec3(h1, 0.8, 1.0));
    vec3 iridB = hsv2rgb(vec3(h2, 0.9, 0.9));
    vec3 iridC = hsv2rgb(vec3(h3, 0.7, 1.0));

    float w1 = pow(abs(bend), 1.5);
    float w2 = pow(abs(1.0 - bend), 1.5);
    vec3 albedo = mix(mix(iridA, iridB, w1), iridC, w2 * 0.5);

    float metallic  = 0.85;
    float roughness = 0.06;

    vec3 L1 = normalize(vec3(1.0, 1.2, 0.7));
    vec3 L2 = normalize(vec3(-0.7, 0.4, -1.0));

    vec3 sh = cookTorrance(N, V, L1, albedo, metallic, roughness) * vec3(1.2, 1.1, 1.3) * 3.5;
    sh     += cookTorrance(N, V, L2, albedo, metallic, roughness) * vec3(0.6, 0.5, 1.2) * 2.0;

    vec3 env = envLighting(N, V, albedo, metallic, roughness,
                           vec3(0.06, 0.03, 0.15), vec3(0.01, 0.0, 0.04));

    float fresnelEmit = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 emission = iridA * fresnelEmit * 0.6;

    return sh + env * 0.5 + emission;
}

vec3 recurseColor(vec3 pos, float t, int depth) {
    vec3 col = vec3(0.0);
    float weight = 1.0;

    for (int i = 0; i < depth; i++) {
        float fi = float(i);

        vec3 q = mod(pos * pow(4.0, fi) + t * (0.1 + fi * 0.05), 4.0) - 2.0;
        float cellHash = hash13(floor(pos * pow(4.0, fi)));

        float h = fract(cellHash + t * 0.05 + fi * 0.17);
        vec3 localColor = hsv2rgb(vec3(h, 0.8, 0.9));

        float r = length(q);
        float glow = exp(-r * 3.0) * (0.3 + fbm3(q + vec3(t * 0.1), 3, 2.0, 0.5) * 0.3);

        col += localColor * glow * weight;
        weight *= 0.5;
    }

    return col;
}

vec3 universeParticleShading(vec3 pos, float t) {
    vec3 c = recurseColor(pos, t, 3);

    float n = fbm3(pos * 8.0 + vec3(t * 0.1), 4, 2.0, 0.5);
    c *= 1.0 + n * 0.5;

    float beat = uBeatStrength * exp(-uBeatPhase * 2.0);
    c += vec3(0.8, 0.4, 1.0) * beat * 2.0;
    c *= 4.0;

    return c;
}

// ============================================================
// SECTION 9: EXTENDED CAMERA SYSTEM
// ============================================================

struct CameraState {
    vec3 ro;
    vec3 rd;
    float fov;
    float lensDistort;
    float shake;
};

CameraState buildCamera(vec2 ndc, float progress, float t) {
    CameraState cam;

    float phase1 = remap01(progress, 0.0, 0.2);
    float phase2 = remap01(progress, 0.2, 0.5);
    float phase3 = remap01(progress, 0.5, 0.7);
    float phase4 = remap01(progress, 0.7, 1.0);

    float smoothP1 = smoothstep(0.0, 1.0, phase1);
    float smoothP2 = smoothstep(0.0, 1.0, phase2);
    float smoothP3 = smoothstep(0.0, 1.0, phase3);
    float smoothP4 = smoothstep(0.0, 1.0, phase4);

    float baseDist;
    float baseAngleX;
    float baseAngleY;

    if (progress < 0.2) {
        baseDist   = mix(0.5, 0.75, smoothP1);
        baseAngleX = t * 0.08;
        baseAngleY = mix(0.05, 0.15, smoothP1);
    } else if (progress < 0.5) {
        baseDist   = mix(0.75, 2.0, smoothP2);
        baseAngleX = t * 0.12;
        baseAngleY = mix(0.15, 0.25, smoothP2);
    } else if (progress < 0.7) {
        float holyShitZoom = smoothstep(0.0, 1.0, smoothP3);
        baseDist   = mix(2.0, 8.0, holyShitZoom * holyShitZoom);
        baseAngleX = t * 0.18 + holyShitZoom * 0.5;
        baseAngleY = mix(0.25, 0.6, holyShitZoom);
    } else {
        baseDist   = mix(8.0, 14.0, smoothP4);
        baseAngleX = t * 0.08 + 0.5;
        baseAngleY = mix(0.6, 0.4, smoothP4);
    }

    float beat = uBeatStrength * exp(-uBeatPhase * 5.0);
    float shakeAmt = beat * 0.04;
    float shakeX = hash11(t * 100.0) * 2.0 - 1.0;
    float shakeY = hash11(t * 137.0) * 2.0 - 1.0;
    float shakeZ = hash11(t * 173.0) * 2.0 - 1.0;
    cam.shake = shakeAmt;

    vec3 baseRO = vec3(
        sin(baseAngleX) * baseDist,
        cos(baseAngleX * 0.7) * baseDist * baseAngleY,
        cos(baseAngleX) * baseDist
    );
    baseRO += vec3(shakeX, shakeY, shakeZ) * shakeAmt;

    if (progress > 0.5) {
        float warpAmt = smoothstep(0.5, 0.8, progress);
        vec3 nonEuclidRO = nonEuclideanPos(baseRO, t);
        baseRO = mix(baseRO, nonEuclidRO, warpAmt * 0.3);
    }

    cam.ro = baseRO;

    float baseFOV;
    if (progress < 0.2) {
        baseFOV = mix(35.0, 45.0, smoothP1);
    } else if (progress < 0.5) {
        baseFOV = mix(45.0, 60.0, smoothP2);
    } else if (progress < 0.7) {
        baseFOV = mix(60.0, 90.0, smoothP3);
    } else {
        baseFOV = mix(90.0, 75.0, smoothP4);
    }
    cam.fov = radians(baseFOV);

    cam.lensDistort = smoothstep(0.45, 0.75, progress) * 0.25;

    vec3 target = vec3(0.0);
    vec3 fwd   = normalize(target - cam.ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    if (length(cross(fwd, vec3(0.0, 1.0, 0.0))) < 0.001)
        right = normalize(cross(fwd, vec3(1.0, 0.0, 0.0)));
    vec3 up = cross(right, fwd);

    vec2 ndcWarped = ndc;
    float r2 = dot(ndc, ndc);
    ndcWarped *= 1.0 + cam.lensDistort * r2;

    cam.rd = normalize(fwd + ndcWarped.x * right * tan(cam.fov*0.5) + ndcWarped.y * up * tan(cam.fov*0.5));

    return cam;
}

// ============================================================
// SECTION 10: FULL MAIN
// ============================================================

void main() {
    vec2 uv = vUV;
    vec2 ndc = (uv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);

    // --- Camera ---
    CameraState cam = buildCamera(ndc, uProgress, uTime);
    vec3 ro = cam.ro;
    vec3 rd = cam.rd;

    // --- Background ---
    vec3 bgCol = nebulaBackground(uv, rd, uTime);

    // --- Raymarch ---
    vec3 hitInfo = rayMarch6(ro, rd);
    float tHit = hitInfo.x;
    float matID = hitInfo.y;
    float stepCount = hitInfo.z;

    vec3 col = bgCol;

    // --- Surface shading ---
    if (matID > 0.0 && tHit < 24.0) {
        vec3 pos = ro + rd * tHit;

        // --- Material 1: Mandelbulb ---
        if (matID < 1.5) {
            vec3 N = calcNormal6(pos);
            vec3 V = -rd;
            vec4 trap = mandelbulbOrbitTrap(pos * mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)));
            float ao = calcAO6(pos, N);
            col = mandelbulbShading(pos, N, V, uTime, trap, uProgress) * ao;

            float innerGlowSteps = exp(-stepCount * 0.005) * 0.3;
            col += vec3(0.3, 0.8, 1.0) * innerGlowSteps;
        }

        // --- Material 2: Mandelbox ---
        else if (matID < 2.5) {
            vec3 N = calcNormal6Mandelbox(pos);
            vec3 V = -rd;
            vec4 trap = mandelboxColor(pos * mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)) * 0.6);
            float ao = calcAO6(pos, N);
            col = mandelboxShading(pos, N, V, uTime, trap) * ao;

            float innerGlowSteps = exp(-stepCount * 0.006) * 0.25;
            col += vec3(0.5, 0.3, 1.0) * innerGlowSteps;
        }

        // --- Material 3: Sierpinski Tetrahedron ---
        else if (matID < 3.5) {
            vec3 N = calcNormalSierpinski(pos);
            vec3 V = -rd;
            float ao = calcAO6(pos, N);
            col = sierpinskiShading(pos, N, V, uTime) * ao;

            float edge = exp(-stepCount * 0.004) * 0.2;
            col += vec3(0.7, 0.2, 1.0) * edge;
        }

        // --- Material 4: Klein Bottle / Kleinian Group ---
        else if (matID < 4.5) {
            const float e = 0.001;
            vec3 ep = vec3(e, 0.0, 0.0);
            float scale = mix(1.5, 0.3, smoothstep(0.3, 0.9, uProgress)) * 0.8;
            vec3 kp = kleinBottle(pos * scale, uTime);
            vec3 N = normalize(vec3(
                sdKleinianGroup(kleinBottle((pos + ep.xyy)*scale, uTime)) - sdKleinianGroup(kleinBottle((pos - ep.xyy)*scale, uTime)),
                sdKleinianGroup(kleinBottle((pos + ep.yxy)*scale, uTime)) - sdKleinianGroup(kleinBottle((pos - ep.yxy)*scale, uTime)),
                sdKleinianGroup(kleinBottle((pos + ep.yyx)*scale, uTime)) - sdKleinianGroup(kleinBottle((pos - ep.yyx)*scale, uTime))
            ));
            vec3 V = -rd;
            col = kleinBottleShading(pos, N, V, uTime);

            float impossibleGlow = exp(-stepCount * 0.003) * 0.35;
            col += vec3(0.9, 0.5, 1.0) * impossibleGlow;
        }

        // --- Material 5: Universe Particles ---
        else if (matID < 5.5) {
            col = universeParticleShading(pos, uTime);
        }

        // --- Fractal fog pass ---
        vec3 fog = fractalFog(ro, rd, tHit, uTime);
        col += fog;

        // --- Dust overlay ---
        float dust = fractalDust(pos, uTime);
        col = mix(col, col + vec3(0.2, 0.15, 0.3), dust * 0.3);

        // --- Distance fog ---
        float fogDepth = 1.0 - exp(-tHit * 0.08);
        vec3 fogColor = bgCol * 2.0;
        col = mix(col, fogColor, fogDepth * 0.4);
    } else {
        // Thin fractal fog even on miss
        vec3 fog = fractalFog(ro, rd, 20.0, uTime);
        col += fog * 0.3;
    }

    // --- Portal ring overlays (4 portals) ---
    float portalProgress = smoothstep(0.1, 0.5, uProgress);

    vec2 p1 = vec2(0.25, 0.3);
    vec2 p2 = vec2(0.75, 0.25);
    vec2 p3 = vec2(0.2, 0.7);
    vec2 p4 = vec2(0.78, 0.72);

    float r1 = (0.06 + sin(uTime * 0.8) * 0.01) * portalProgress;
    float r2 = (0.05 + sin(uTime * 1.1 + 1.2) * 0.01) * portalProgress;
    float r3 = (0.07 + sin(uTime * 0.6 + 2.4) * 0.01) * portalProgress;
    float r4 = (0.04 + sin(uTime * 1.3 + 0.7) * 0.008) * portalProgress;

    col += renderPortalRing(uv, p1, r1, uTime + 0.0);
    col += renderPortalRing(uv, p2, r2, uTime + 1.4);
    col += renderPortalRing(uv, p3, r3, uTime + 2.8);
    col += renderPortalRing(uv, p4, r4, uTime + 4.2);

    // --- Portal UV distortion (center wormhole) ---
    float portalStrength = smoothstep(0.2, 0.6, uProgress) * 1.5;
    vec2 warpedUV = portalUV(uv, vec2(0.5), 0.3, portalStrength);
    float wormDist = length(uv - vec2(0.5));
    float wormRing = exp(-abs(wormDist - 0.28) / 0.015) * portalStrength * 0.6;
    col += vec3(0.1, 0.4, 0.9) * wormRing;

    // --- Recursive universe reveal overlay (progress > 0.6) ---
    float revealProgress = smoothstep(0.6, 0.95, uProgress);
    if (revealProgress > 0.001) {
        vec2 revealUV = uv - vec2(0.5);
        float revealR = length(revealUV);
        float revealAngle = atan(revealUV.y, revealUV.x);

        float outerRing = exp(-abs(revealR - 0.45 * revealProgress) / 0.012) * revealProgress;
        float innerRing = exp(-abs(revealR - 0.22 * revealProgress) / 0.008) * revealProgress;
        float microRing = exp(-abs(revealR - 0.10 * revealProgress) / 0.005) * revealProgress;

        float ringSpiral = sin(revealAngle * 8.0 + uTime * 3.0) * 0.5 + 0.5;
        col += vec3(0.4, 0.8, 1.0) * outerRing * (0.5 + ringSpiral * 0.5) * 2.0;
        col += vec3(0.8, 0.4, 1.0) * innerRing * 2.5;
        col += vec3(1.0, 0.9, 0.5) * microRing * 3.0;

        float revealGlow = exp(-revealR * 2.5) * revealProgress * revealProgress;
        col += vec3(0.3, 0.5, 1.0) * revealGlow * 0.8;

        float gridAngle = mod(revealAngle / (2.0 * PI) + 0.5, 1.0);
        float gridLine = pow(abs(sin(gridAngle * 32.0 * PI)), 20.0);
        float gridFade = smoothstep(0.5, 0.0, revealR);
        col += vec3(0.2, 0.5, 0.9) * gridLine * gridFade * revealProgress * 0.5;

        vec3 recurse = recurseColor(vec3(revealUV * 3.0, uTime * 0.1), uTime, 3);
        col += recurse * revealProgress * 0.4 * smoothstep(0.38, 0.0, revealR);
    }

    // --- Beat supernova pulse ---
    float beatRaw = uBeatStrength;
    float beatEnv = exp(-uBeatPhase * 4.0);
    float beatPulse = beatRaw * beatEnv;

    if (beatPulse > 0.01) {
        col += vec3(0.6, 0.3, 1.0) * beatPulse * 0.8;

        float megaBeat = smoothstep(0.85, 1.0, beatRaw);
        if (megaBeat > 0.001) {
            float novelFlash = megaBeat * (1.0 - uBeatPhase);
            col = mix(col, vec3(1.0, 0.95, 1.0), novelFlash * 0.5);
            col += vec3(0.5, 0.2, 1.0) * novelFlash * 2.0;

            float warpR = length(ndc);
            float screenWarp = sin(warpR * 20.0 - uTime * 10.0) * novelFlash * 0.03;
            vec2 warpedNDC = ndc * (1.0 + screenWarp);
            float warpBright = smoothstep(0.8, 1.2, length(warpedNDC) / max(length(ndc), 0.001));
            col += vec3(0.8, 0.5, 1.0) * warpBright * novelFlash * 0.5;

            vec3 rChannel = col + vec3(0.1, -0.05, -0.05) * novelFlash;
            vec3 gChannel = col;
            vec3 bChannel = col + vec3(-0.05, -0.05, 0.1) * novelFlash;
            float chromAmt = novelFlash * 0.3;
            col = mix(col, (rChannel + gChannel + bChannel) / 3.0, chromAmt);
            col.r += (rChannel.r - col.r) * chromAmt;
            col.b += (bChannel.b - col.b) * chromAmt;
        }
    }

    // --- Chromatic aberration (holy-shit moment) ---
    float holyShitIntensity = smoothstep(0.5, 0.72, uProgress) * (1.0 - smoothstep(0.88, 1.0, uProgress));
    if (holyShitIntensity > 0.001) {
        float chromOffset = holyShitIntensity * 0.012;
        vec2 chromDir = normalize(ndc + vec2(0.001));
        vec2 uvR = uv + chromDir * chromOffset;
        vec2 uvB = uv - chromDir * chromOffset;

        uvR = clamp(uvR, 0.001, 0.999);
        uvB = clamp(uvB, 0.001, 0.999);

        float rR = col.r * (1.0 + holyShitIntensity * 0.3);
        float bB = col.b * (1.0 + holyShitIntensity * 0.3);

        float edgeDist = length(uv - 0.5) * 2.0;
        float chromFade = smoothstep(0.3, 1.0, edgeDist);
        col.r = mix(col.r, rR, chromFade);
        col.b = mix(col.b, bB, chromFade);
    }

    // --- ACES tone mapping ---
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e2 = 0.14;
    col = clamp((col*(a*col+b)) / (col*(c*col+d)+e2), 0.0, 1.0);

    // --- Gamma ---
    col = pow(col, vec3(1.0/2.2));

    // --- Vignette ---
    vec2 vigUV = uv * 2.0 - 1.0;
    float vig = 1.0 - dot(vigUV * 0.6, vigUV * 0.6);
    vig = clamp(pow(vig, 2.2), 0.0, 1.0);
    float vigStrength = mix(0.6, 0.85, smoothstep(0.5, 0.8, uProgress));
    col *= mix(1.0 - vigStrength, 1.0, vig);

    // --- Film grain ---
    float grain = (hash12(uv + vec2(uTime * 0.01)) - 0.5) * 0.025;
    col += vec3(grain);

    // --- Final output ---
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
