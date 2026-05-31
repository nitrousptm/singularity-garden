#version 460 core
// SCENE 2: AWAKENING CORE — Performance-optimized + visual overhaul
// Kein spektrales Multi-Ray, kontrollierte HDR-Werte, 72 RM-Steps

#include "../common/noise.glsl"
#include "../common/sdf.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform float uHolyShitPhase;
uniform vec2  uResolution;

// ================================================================
// UTILS
// ================================================================
float easeInOut(float t) { return t * t * (3.0 - 2.0 * t); }
float beatPulse()        { return uBeatStrength * max(0.0, 1.0 - uBeatPhase * 2.5); }
mat3  rotY(float a)      { float c=cos(a),s=sin(a); return mat3(c,0,s, 0,1,0,-s,0,c); }

// ================================================================
// SDF SCENE
// ================================================================
vec2 sdScene(vec3 p) {
    // Monolith
    float warp = fbm3(p * 0.45 + vec3(uTime * 0.07, 0.0, uTime * 0.05), 4, 2.0, 0.5);
    vec3 mp = p + vec3(warp, 0.0, warp) * uProgress * 0.35;
    mp = rotY(uHolyShitPhase * 0.18) * mp;
    mp = opTwist(mp + vec3(0.0,-1.0,0.0), warp * 0.024 * uProgress + uHolyShitPhase * 0.08);
    float surfRipple = sin(p.y * 3.0 - uTime * 20.0) * 0.018 * (1.0 - uBeatPhase) * uBeatStrength;
    float detail     = fbm3(mp * 5.8 + uTime * 0.03, 3, 2.0, 0.5) * 0.05 * uProgress;
    float fracture   = fbm3(mp * 11.0 + uTime * 0.12, 2, 2.0, 0.5) * uHolyShitPhase * 0.14;
    float monolith   = sdBox(mp, vec3(1.35, 6.8, 0.48)) + surfRipple + detail + fracture;

    // Energy Core
    float coreR  = 0.38 * smoothstep(0.0, 0.45, uProgress);
    float cPulse = 1.0 + 0.20 * (1.0 - uBeatPhase) * uBeatStrength;
    float core1  = sdSphere(p + vec3(0.0,-1.8,0.0), coreR * cPulse);
    float core2  = sdSphere(p + vec3(0.0, 0.3,0.0), coreR * 0.55 * cPulse);
    float core3  = sdSphere(p + vec3(0.0, 2.2,0.0), coreR * 0.28 * cPulse);
    float core   = smin(core1, smin(core2, core3, 0.65), 0.85);

    // Ground
    float hexRel = hexGrid(p.xz * 0.42 + 0.5, 11.0) * 0.07;
    float ground = p.y + 7.2 + hexRel;

    // 6 Tentakel-Filamente (statt 14)
    float tentacles = 1e9;
    for (int i = 0; i < 6; i++) {
        float fi  = float(i);
        float ang = fi * 2.399 + uTime * (0.18 + fi * 0.028) * (1.0 + beatPulse() * 0.10);
        float reach = uProgress * (2.2 + fi * 0.30);
        vec3 tip = vec3(sin(ang) * reach, cos(fi * 0.85 + uTime * 0.22) * 1.2, cos(ang) * reach);
        float w = fbm3(p * 0.4 + uTime * 0.05 + fi * 1.5, 2, 2.0, 0.5) * 0.55;
        vec3 pw = p + vec3(w, w*0.4, -w) * uProgress;
        vec3 ba = tip;
        float h = clamp(dot(pw, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
        float r = 0.045 + (1.0 - h) * 0.02 * uProgress;
        tentacles = min(tentacles, length(pw - ba * h) - r);
    }

    // 12 Debris
    float debris = 1e9;
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float ang = fi * 2.399 + uTime * (0.22 + fi * 0.025) * (1.0 + beatPulse() * 0.45);
        float radius = 2.3 + fi * 0.16 + uHolyShitPhase * fi * 0.10;
        float height = cos(fi * 1.73 + uTime * (0.28 + fi * 0.018)) * 2.8 - 0.8;
        vec3 dpos = vec3(sin(ang)*radius, height, cos(ang)*radius);
        float dr = 0.05 + 0.09 * hash11(fi * 0.719);
        float appear = smoothstep(0.0, 0.55, uProgress - fi * 0.018);
        debris = min(debris, sdSphere(p - dpos, dr * appear));
    }

    vec2 res = sminMat(vec2(monolith, 1.0), vec2(core,     2.0), 0.4);
    res       = sminMat(res,                 vec2(ground,   3.0), 0.2);
    res       = sminMat(res,                 vec2(debris,   4.0), 0.1);
    res       = sminMat(res,                 vec2(tentacles,5.0), 0.08);
    return res;
}

// ================================================================
// RAYMARCHER — 72 Steps, kein Multi-Ray
// ================================================================
vec2 rayMarch(vec3 ro, vec3 rd) {
    float t = 0.01, mat = 0.0;
    for (int i = 0; i < 72; i++) {
        vec2 h = sdScene(ro + rd * t);
        if (h.x < 0.0018) { mat = h.y; break; }
        if (t > 55.0) break;
        t += h.x * 0.88;
    }
    return vec2(t, mat);
}

vec3 calcNormal(vec3 p) {
    const float e = 0.001;
    return normalize(vec3(
        sdScene(p+vec3(e,0,0)).x - sdScene(p-vec3(e,0,0)).x,
        sdScene(p+vec3(0,e,0)).x - sdScene(p-vec3(0,e,0)).x,
        sdScene(p+vec3(0,0,e)).x - sdScene(p-vec3(0,0,e)).x));
}

float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 4; i++) {
        float h = 0.01 + 0.14 * float(i) / 3.0;
        occ += (h - sdScene(pos + h * nor).x) * sca;
        sca *= 0.92;
    }
    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

// ================================================================
// GOD RAYS — 24 Steps (statt 48)
// ================================================================
vec3 godRays(vec3 ro, vec3 rd, vec3 lp, float boost) {
    vec3 rays = vec3(0.0);
    float t = 0.3;
    for (int i = 0; i < 24; i++) {
        vec3 pos = ro + rd * t;
        float dist = length(pos - lp);
        float sc = exp(-dist * 0.20) * (1.0 + boost * 1.8);
        float nv = vnoise3(pos * 1.3 + uTime * 0.06) * 0.55 + 0.45;
        float hf = exp(-abs(pos.y - lp.y) * 0.16);
        rays += vec3(0.8, 0.6, 1.0) * sc * nv * hf * 0.025;
        t += 0.55;
    }
    return rays;
}

// Shockwave-Ringe auf dem Boden
float shockwaveRing(vec3 pos, float beatPhase, float strength) {
    float total = 0.0;
    for (int h = 1; h <= 3; h++) {
        float radius = beatPhase * 16.0 / float(h);
        float ring   = abs(length(pos.xz) - radius);
        float w = 0.28 + beatPhase * 0.55;
        total += exp(-ring / w) * (1.0 - beatPhase) * strength / float(h);
    }
    return total;
}

// Energie-Wellen: 3 Ringe statt 4
float energyWaves(vec3 p, float beatPhase, float beatStr) {
    float r = length(p.xz);
    float total = 0.0;
    for (int i = 0; i < 3; i++) {
        float ph = fract(beatPhase + float(i) * 0.333);
        float wR = ph * 20.0;
        total += exp(-pow(r - wR, 2.0) * 20.0) * (1.0 - ph) * beatStr;
    }
    return total * 2.0;
}

// ================================================================
// SKY
// ================================================================
vec3 skyColor(vec3 rd, float prog) {
    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 hori = mix(vec3(0.018, 0.022, 0.10), vec3(0.048, 0.012, 0.20), prog);
    vec3 zen  = mix(vec3(0.000, 0.000, 0.025), vec3(0.008, 0.000, 0.10), prog);
    // Sterne
    float s1 = hash13(floor(rd * 180.0 + 0.5));
    float stars = pow(max(0.0, s1 - 0.97), 2.0) * 22.0 * (1.0 - h * 1.3) * prog;
    return mix(hori, zen, pow(h, 0.35)) + stars * 0.4;
}

// ================================================================
// KAMERA
// ================================================================
vec3 getCamPos(float prog, float st, float beat) {
    float nudge = beat * 0.09;
    if (prog < 0.28) {
        float t = easeInOut(prog / 0.28);
        return vec3(sin(st*0.12)*(mix(1.2,4.5,t))+nudge, mix(22.0,8.0,t), cos(st*0.12)*mix(1.2,4.5,t));
    } else if (prog < 0.65) {
        float t = easeInOut((prog-0.28)/0.37);
        float ang = st*0.20+0.6;
        return vec3(sin(ang)*mix(4.5,9.5,t)+nudge, mix(8.0,1.6,t), cos(ang)*mix(4.5,9.5,t));
    } else {
        float t = easeInOut((prog-0.65)/0.35);
        float ang = st*0.16+2.2;
        float d = mix(9.5, 16.0 + uHolyShitPhase*3.0, t);
        return vec3(sin(ang)*d+nudge, mix(1.6,6.0,t), cos(ang)*d);
    }
}

// ================================================================
// MAIN
// ================================================================
void main() {
    vec2 ndc = (vUV * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
    float beat = beatPulse();
    float hs   = uHolyShitPhase;

    // Kamera
    vec3 ro     = getCamPos(uProgress, uSceneTime, beat);
    vec3 target = vec3(0.0, 0.8, 0.0);
    vec3 fwd    = normalize(target - ro);
    vec3 right  = normalize(cross(fwd, vec3(0,1,0)));
    vec3 up_    = cross(right, fwd);

    float fovTan = tan(radians(52.0 + uProgress*15.0 + hs*8.0) * 0.5);
    float shake  = beat * 0.012 + hs * 0.018;
    vec2 shk     = vec2(sin(uTime*83.0), cos(uTime*71.0)) * shake;

    vec3 rd = normalize(fwd
        + (ndc.x + shk.x) * right * fovTan
        + (ndc.y + shk.y) * up_   * fovTan);

    vec3 col = skyColor(rd, uProgress);

    // Raymarching
    vec2 hit    = rayMarch(ro, rd);
    float t     = hit.x;
    float matID = hit.y;

    vec3 lPos  = vec3(4.5*sin(uTime*0.22), 8.5, 4.5*cos(uTime*0.22));
    vec3 lRim  = vec3(-lPos.x*0.8, lPos.y*0.4, -lPos.z*0.8);
    vec3 lFill = vec3(0.0, -2.0, 8.5);

    if (matID > 0.0 && t < 55.0) {
        vec3 pos = ro + rd * t;
        vec3 N   = calcNormal(pos);
        vec3 V   = -rd;
        float ao = calcAO(pos, N);

        vec3 L    = normalize(lPos  - pos);
        vec3 Lrim = normalize(lRim  - pos);
        vec3 Lfil = normalize(lFill - pos);
        float rim = pow(max(0.0, 1.0 - dot(N, V)), 2.8);
        float rP  = 1.0 + beat * 2.8;

        if (matID < 1.5) {
            // MONOLITH
            vec3 alb = vec3(0.018, 0.018, 0.038);
            float ro2=0.20, me=0.97;
            vec3 shade = cookTorrance(N,V,L,    alb,me,ro2) * vec3(0.6,0.80,1.0)*4.0
                       + cookTorrance(N,V,Lrim,  alb,me,ro2) * vec3(0.22,0.42,1.0)*3.2*rP
                       + cookTorrance(N,V,Lfil,  alb,me,ro2) * vec3(0.08,0.14,0.45)*1.5;
            vec3 env = envLighting(N,V,alb,me,ro2,
                mix(vec3(0.035,0.055,0.20),vec3(0.10,0.04,0.45),hs),
                vec3(0.008,0.008,0.030));

            // Energie-Risse (multi-layer)
            float c1 = domainWarpFbm(pos*2.8 + uTime*0.09, 4);
            float c2 = fbm3(pos*7.0 - uTime*0.07, 3, 2.0, 0.5);
            float c3 = fbm3(pos*13.0 + uTime*0.14, 2, 2.0, 0.5);
            float crk = pow(max(0.0,c1-0.40),2.8)*pow(max(0.0,c2-0.32),2.0)
                      + pow(max(0.0,c3-0.50),3.0)*0.5;
            float crAmt = uProgress*(1.0+beat*0.6)*(1.0+hs*1.8);
            vec3 crHue = mix(vec3(0.0,0.65,1.0), vec3(0.55,0.12,1.0), uBarPhase);
            crHue = mix(crHue, vec3(1.0,0.4,0.1), hs);
            vec3 emission = crHue * crk * crAmt * 4.5
                          + crHue * rim * rP * uProgress * 1.0
                          + crHue * hs * 3.5 * (0.4 + rim * 1.8);
            col = shade + env*ao + emission;

        } else if (matID < 2.5) {
            // ENERGY CORE — kontrollierte Intensität!
            vec3 hot  = mix(vec3(0.55,0.88,1.0), vec3(1.0,0.95,0.65),
                            sin(uTime*4.0)*0.5+0.5);
            vec3 cool = mix(vec3(0.0,0.42,1.0), vec3(0.38,0.0,1.0), uBarPhase);
            float pulse = 1.0 + 0.40*(1.0-uBeatPhase)*uBeatStrength;
            float glow  = fbm3(pos*5.5 + uTime*0.28, 2, 2.0, 0.5);
            float fWave = sin(length(pos.xz)*8.0 - uTime*12.0)*0.5+0.5;
            // KONTROLLIERT: max 5.0 Basis, +2 Beat, +3 Holy-Shit (kein x20 mehr!)
            float intensity = 4.5 + beat*1.8 + hs*3.0;
            col = mix(cool, hot, glow*fWave) * intensity * pulse;

        } else if (matID < 3.5) {
            // BODEN
            vec3 alb = vec3(0.025,0.025,0.048);
            vec3 shade = cookTorrance(N,V,L,alb,0.82,0.30)*vec3(0.5,0.72,1.0)*3.2;
            vec3 env   = envLighting(N,V,alb,0.82,0.30,vec3(0.018,0.038,0.14),vec3(0.006));
            float hexG = hexGrid(pos.xz*0.42+0.5, 11.0);
            float shock= shockwaveRing(pos, uBeatPhase, uBeatStrength);
            vec3 sHue  = mix(vec3(0.0,0.5,1.0), vec3(0.5,0.0,1.0), uBarPhase);
            col = shade + env*ao
                + vec3(0.0,0.55,1.0)*hexG*(0.5+beat*0.7)*uProgress
                + sHue*shock*2.2
                + sHue*hs*hexG*1.5;

        } else if (matID < 4.5) {
            // DEBRIS
            float dH = hash12(pos.xy+pos.z*0.37);
            vec3 dCol= mix(vec3(0.12,0.52,1.0), vec3(0.68,0.18,1.0), dH);
            col = dCol*(3.5+beat*dH*2.0+hs*2.5) + dCol*rim*2.5;

        } else {
            // TENTAKEL
            float tH = hash13(floor(pos*6.0));
            vec3 tc  = mix(vec3(0.0,1.0,0.55), vec3(0.8,0.1,1.0), tH);
            float tG = fbm3(pos*4.0+uTime*0.2, 2, 2.0, 0.5);
            col = tc*(4.0+beat*1.5+hs*3.5)*(0.6+tG*0.7);
        }

        // Fog
        float fog = 1.0 - exp(-t*0.012);
        col = mix(col, skyColor(rd, uProgress), fog);
    }

    // GOD RAYS
    vec3 rays1 = godRays(ro, rd, vec3(0.0,-1.0,0.0), beat);
    vec3 rays2 = godRays(ro, rd, vec3(0.0, 6.8,0.0), beat*0.45)
               * smoothstep(0.32,0.70,uProgress);
    col += rays1*uProgress*3.0 + rays2*1.8;

    // ENERGIE-WELLEN
    vec3 wSample = ro + rd * (t * 0.5);
    float waves  = energyWaves(wSample, uBeatPhase, uBeatStrength);
    col += mix(vec3(0.0,1.0,0.5), vec3(1.0,0.15,1.0), uBarPhase*0.7) * waves * 4.0;

    // HOLY-SHIT SCREEN EFFECTS
    if (hs > 0.0) {
        float radDist = length(vUV - 0.5);
        col += mix(vec3(0.1,0.4,1.0), vec3(1.0,0.3,0.0), hs)
             * exp(-radDist*(3.5-hs*2.0)) * hs * 4.0;
        // Screen Chromatic Aberration
        float ca = hs * 0.006;
        col.r = mix(col.r, col.r + sin(vUV.y*80.0+uTime*5.0)*ca, hs*0.5);
        col.b = mix(col.b, col.b + cos(vUV.x*80.0+uTime*4.0)*ca, hs*0.5);
    }

    // BPM FLASHES
    float barFlash  = pow(max(0.0,1.0-uBarPhase*7.0),3.0)*0.40
                    * smoothstep(0.22,0.48,uProgress);
    float beatFlash = pow(max(0.0,1.0-uBeatPhase*5.0),4.0)*0.20*uBeatStrength;
    col += mix(vec3(0.25,0.55,1.0),vec3(0.5,0.1,1.0),uBarPhase)*(barFlash+beatFlash);

    // VIGNETTE
    vec2 vig = (vUV-0.5)*2.0;
    col *= 1.0 - dot(vig,vig)*(0.28+hs*0.12);

    // FADE IN — verhindert weißen Blitz am Szenenanfang
    col *= smoothstep(0.0, 0.10, uProgress);

    fragColor = vec4(col, 1.0);
}
