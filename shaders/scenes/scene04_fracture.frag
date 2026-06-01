#version 460 core
// SCENE 4: TIME FRACTURE — Temporal Reality Dissolving
// Duration: 1:15 - 1:45 (30 seconds)
// Extended: multi-gen Julia sets, recursive fracture networks, wormhole chains,
//           temporal echo ghosts, inverse-stereographic warps, full feedback

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;
uniform sampler2D uPrevFrame;

#define PI  3.14159265359
#define TAU 6.28318530718

// =====================================================================
// MATH UTILS
// =====================================================================
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d=dot(b,b); return vec2(dot(a,b),a.y*b.x-a.x*b.y)/d; }
vec2 cinv(vec2 z)         { return vec2(z.x,-z.y)/dot(z,z); }
vec2 cpow(vec2 z, float n){
    float r=length(z), a=atan(z.y,z.x);
    return pow(r,n)*vec2(cos(a*n), sin(a*n));
}
vec2 cexp(vec2 z)  { return exp(z.x)*vec2(cos(z.y), sin(z.y)); }
vec2 clog(vec2 z)  { return vec2(log(length(z)), atan(z.y,z.x)); }
vec2 csin(vec2 z)  { return vec2(sin(z.x)*cosh(z.y), cos(z.x)*sinh(z.y)); }
vec2 ccos(vec2 z)  { return vec2(cos(z.x)*cosh(z.y),-sin(z.x)*sinh(z.y)); }

// =====================================================================
// NOISE (local)
// =====================================================================
float h11(float p)  { return fract(sin(p*127.1)*43758.5453); }
float h12(vec2  p)  { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec2  h22(vec2  p)  { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),
                                            dot(p,vec2(269.5,183.3))))*43758.5453); }

float vn2(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),
               mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
    float v=0.0, a=0.5;
    mat2 rot=mat2(0.8,0.6,-0.6,0.8);
    for(int i=0;i<5;i++){v+=a*vn2(p);p=rot*p*2.1+vec2(0.9,1.7);a*=0.5;}
    return v;
}

// =====================================================================
// JULIA SET (smooth iteration count + orbit traps)
// =====================================================================
struct JuliaResult { float smooth_iter; vec4 trap; };

JuliaResult julia(vec2 z, vec2 c, int maxIter) {
    float r2 = 0.0;
    int i;
    vec4 trap = vec4(abs(z.x), abs(z.y), dot(z,z), length(z));
    for(i=0; i<maxIter; i++) {
        z  = cmul(z,z) + c;
        r2 = dot(z,z);
        trap = min(trap, vec4(abs(z.x), abs(z.y), r2, length(z)));
        if(r2 > 4.0) break;
    }
    float si = float(i)/float(maxIter) - log2(log2(r2))/float(maxIter);
    return JuliaResult(clamp(si,0.0,1.0), trap);
}

// Burning Ship fractal (for added weirdness)
float burningShip(vec2 c, int maxIter) {
    vec2 z = vec2(0.0);
    int i;
    for(i=0; i<maxIter; i++) {
        z = vec2(z.x*z.x - z.y*z.y + c.x,
                 2.0*abs(z.x*z.y) + c.y);
        if(dot(z,z) > 4.0) break;
    }
    return float(i)/float(maxIter);
}

// Newton fractal (converges to cube roots of unity)
vec3 newtonFractal(vec2 z0) {
    vec2 z = z0;
    const vec2 roots[3] = vec2[3](
        vec2(1.0, 0.0),
        vec2(-0.5,  0.866025),
        vec2(-0.5, -0.866025)
    );
    for(int i=0; i<20; i++) {
        // f(z) = z^3 - 1,  f'(z) = 3z^2
        vec2 z2  = cmul(z,z);
        vec2 z3  = cmul(z2,z);
        vec2 dz  = 3.0*z2;
        vec2 fz  = z3 - vec2(1.0,0.0);
        z = z - cdiv(fz, dz);
    }
    // Find which root we converged to
    vec3 dist = vec3(
        length(z-roots[0]),
        length(z-roots[1]),
        length(z-roots[2])
    );
    float minD = min(dist.x, min(dist.y, dist.z));
    if(dist.x==minD) return vec3(1.0,0.0,0.0);
    if(dist.y==minD) return vec3(0.0,1.0,0.0);
    return vec3(0.0,0.0,1.0);
}

// =====================================================================
// GLITCH SYSTEM (multi-layer)
// =====================================================================
vec2 glitchUV(vec2 uv, float t, float intensity) {
    // Row displacement
    float line      = floor(uv.y*40.0);
    float glitchRow = step(0.97, h12(vec2(line*0.01, floor(t*20.0))));
    float shift     = (h12(vec2(line, floor(t*30.0)))-0.5)*intensity*glitchRow;
    uv.x = fract(uv.x+shift);

    // Block corruption
    vec2  block       = floor(uv*16.0)/16.0;
    float blockCorr   = step(0.95, h12(block+floor(t*15.0)));
    uv += (h22(block+t)-0.5)*0.04*blockCorr*intensity;

    // Fine jitter
    float fineRow  = floor(uv.y*120.0);
    float fineHash = h12(vec2(fineRow*0.21, floor(t*45.0)*0.07));
    uv.x += (fineHash-0.5)*0.002*intensity*step(0.93,fineHash);

    // Vertical slice corruption
    float sliceX   = floor(uv.x*30.0);
    float sliceHash= h12(vec2(sliceX*0.37, floor(t*8.0)*0.13));
    float sliceCorr= step(0.93, sliceHash);
    uv.y = fract(uv.y + (sliceHash-0.5)*0.02*sliceCorr*intensity);

    return uv;
}

// Chromatic split for glitched sampling
vec3 sampleGlitched(sampler2D tex, vec2 uv, float ca) {
    float r = texture(tex, uv+vec2(ca,0)).r;
    float g = texture(tex, uv).g;
    float b = texture(tex, uv-vec2(ca,0)).b;
    return vec3(r,g,b);
}

// =====================================================================
// KALEIDOSCOPE (variable segments, nested)
// =====================================================================
vec2 kaleidoscope(vec2 uv, int segments, float rotation) {
    vec2  p     = uv-0.5;
    float angle = atan(p.y,p.x)+rotation;
    float r     = length(p);
    float seg   = TAU/float(segments);
    angle = mod(angle, seg);
    if(angle > seg*0.5) angle = seg-angle;
    return vec2(cos(angle),sin(angle))*r+0.5;
}

vec2 kaleidoscopeNested(vec2 uv, int seg1, int seg2, float rot1, float rot2) {
    vec2 k1 = kaleidoscope(uv, seg1, rot1);
    return kaleidoscope(k1, seg2, rot2);
}

// =====================================================================
// FRACTURE CRACK SYSTEM (multi-generation)
// =====================================================================
float crackSeg(vec2 uv, vec2 a, vec2 b, float w) {
    vec2  pa = uv-a, ba = b-a;
    float h  = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return w/(length(pa-ba*h)+w);
}

float fractureArm(vec2 uv, vec2 origin, float seed, float spread, int genDepth) {
    float acc = 0.0;
    vec2  p   = origin;
    vec2  dir = normalize(vec2(cos(seed*TAU), sin(seed*TAU)));
    float w   = 0.0005;

    for(int i=0; i<12; i++) {
        float fi   = float(i);
        float bend = (h11(seed*13.7+fi*5.3)-0.5)*0.65;
        float c = cos(bend), s = sin(bend);
        dir = normalize(vec2(dir.x*c-dir.y*s, dir.x*s+dir.y*c));

        float segLen = (0.04+h11(seed*7.1+fi*3.7)*0.12)*spread;
        vec2  next   = p + dir*segLen;

        acc += crackSeg(uv, p, next, w);

        // Branch 1
        if(h11(seed*11.3+fi*2.9) > 0.45) {
            float ba = bend+(h11(seed*1.7+fi*0.3)-0.5)*1.4;
            vec2 bd  = normalize(vec2(dir.x*cos(ba)-dir.y*sin(ba),
                                     dir.x*sin(ba)+dir.y*cos(ba)));
            acc += crackSeg(uv, p, p+bd*segLen*0.45, w*0.5)*0.7;
        }

        // Branch 2 (second generation)
        if(genDepth > 0 && h11(seed*7.5+fi*1.3) > 0.62) {
            float ba2 = bend*0.7+(h11(seed*3.2+fi*0.7)-0.5)*1.8;
            vec2 bd2  = normalize(vec2(dir.x*cos(ba2)-dir.y*sin(ba2),
                                      dir.x*sin(ba2)+dir.y*cos(ba2)));
            acc += crackSeg(uv, p, p+bd2*segLen*0.28, w*0.3)*0.4;
        }

        // Branch 3 (tertiary, very fine)
        if(genDepth > 1 && h11(seed*4.1+fi*0.9) > 0.75) {
            float ba3 = (h11(seed*2.1+fi*0.4)-0.5)*TAU;
            vec2 bd3  = normalize(vec2(cos(ba3), sin(ba3)));
            acc += crackSeg(uv, p, p+bd3*segLen*0.12, w*0.15)*0.25;
        }

        w *= 0.72;
        p = next;
    }
    return acc;
}

// Full spacetime fracture (multi-origin)
float spaceFracture(vec2 uv, float beatBoost) {
    float acc = 0.0;
    const vec2 origins[5] = vec2[5](
        vec2( 0.14,  0.10),
        vec2(-0.30,  0.22),
        vec2( 0.06, -0.33),
        vec2(-0.18, -0.10),
        vec2( 0.28,  0.15)
    );
    for(int ci=0; ci<5; ci++) {
        float sb     = float(ci)*0.37;
        float spread = uProgress*(1.0+beatBoost*float(3-ci)*0.15);
        int   depth  = ci < 3 ? 2 : 1;
        for(int ai=0; ai<6; ai++) {
            acc += fractureArm(uv, origins[ci], sb+float(ai)*0.17+0.03, spread, depth);
        }
    }
    return clamp(acc, 0.0, 2.0);
}

// =====================================================================
// TEMPORAL ECHO GHOSTS
// =====================================================================
vec3 temporalSlice(vec2 uv, float timeOffset, float alpha) {
    float t  = uTime+timeOffset;
    vec2  c  = vec2(sin(t*0.3)*0.5, cos(t*0.4)*0.5);
    vec2  z  = (uv*2.0-1.0)*2.5;
    JuliaResult jr = julia(z, c, 32);

    vec3 a = mix(vec3(0.05,0.10,0.30), vec3(0.80,0.20,0.50), jr.smooth_iter);
    vec3 b = mix(vec3(0.02,0.40,0.80), vec3(1.00,0.10,0.20), jr.trap.x);
    vec3 col = mix(a, b, 0.4);
    return col*(1.0-abs(timeOffset)*0.15)*alpha;
}

// =====================================================================
// FRACTURE RING PORTAL
// =====================================================================
float portalRing(vec2 uv, vec2 center, float r, float timeOff) {
    float d     = length(uv-center);
    float ring  = smoothstep(0.012,0.0,abs(d-r));
    float phase = fract(d/r - uTime*0.8+timeOff);
    return ring*(0.5+0.5*sin(phase*TAU*8.0));
}

// =====================================================================
// WORMHOLE (multi-layer tunnel)
// =====================================================================
vec3 wormhole(vec2 uv, float t) {
    vec2  p      = uv-0.5;
    float r      = length(p);
    float theta  = atan(p.y,p.x);

    // Primary spiral
    float spiral  = theta + r*5.0 - t*2.0;
    float stripes = sin(spiral*8.0)*0.5+0.5;

    // Tunnel rings
    float rings   = sin(r*30.0-t*4.0)*0.5+0.5;

    // Secondary spiral (opposite direction)
    float spiral2 = theta - r*3.0 + t*1.5;
    float str2    = sin(spiral2*12.0)*0.5+0.5;

    // Hexagonal tunnel cross-section
    float hexAngle = mod(theta, PI/3.0);
    float hexR     = mix(sin(PI/6.0), 1.0, 0.5+0.5*cos(hexAngle*6.0));
    float hexRing  = sin(r/hexR*20.0 - t*5.0)*0.5+0.5;

    float lensR = 1.0/(1.0+r*r*4.0);
    vec3  col = mix(vec3(0.05,0.0,0.1), vec3(0.5,0.1,1.0), stripes*rings);
    col = mix(col, vec3(0.0,0.6,0.4), str2*0.3);
    col = mix(col, vec3(0.8,0.3,0.0), hexRing*0.25);
    return col*lensR;
}

// =====================================================================
// REALITY FRACTURE LINES (spiral + radial)
// =====================================================================
float fractureLines(vec2 uv, float t) {
    vec2  p = uv*3.0;
    // Spiral cracks
    float angle  = atan(p.y-1.5, p.x-1.5)+t*0.1;
    float r      = length(p-vec2(1.5));
    float spiral = sin(angle*7.0 - r*4.0 + t*2.0);
    float crack  = smoothstep(0.0,0.02,abs(spiral));

    // Radial bursts
    float radBurst = 0.0;
    for(int i=0; i<8; i++) {
        float ang = float(i)*PI/4.0+t*0.05;
        float d   = abs(cos((angle-ang)*4.0));
        radBurst += smoothstep(0.02,0.0,d*r)*0.15;
    }

    return (1.0-crack)+radBurst;
}

// =====================================================================
// TIME DILATION FIELD
// =====================================================================
vec2 timeDilationWarp(vec2 uv, float t, float prog) {
    // Black hole-like time dilation near fracture points
    vec2  p    = uv-0.5;
    float r    = length(p);

    // Gravitational lensing
    float lens = prog*0.15/(r+0.2);
    vec2  warp = normalize(p)*lens;

    // Rotational frame drag
    float drag = prog*0.08*(1.0/(r+0.1));
    vec2  perp = vec2(-p.y,p.x);
    warp += normalize(perp+0.001)*drag*sin(t*0.5);

    // Temporal wave field
    float wave = sin(r*20.0-t*3.0)*0.005*prog;
    warp += normalize(p)*wave;

    return uv + warp;
}

// =====================================================================
// INVERSE STEREOGRAPHIC WARP (non-Euclidean effect)
// =====================================================================
vec2 inverseStereo(vec2 uv, float t, float strength) {
    vec2  p  = uv*2.0-1.0;
    float r2 = dot(p,p);
    // Project to sphere, rotate, project back
    vec3 sphere = vec3(2.0*p/(1.0+r2), (r2-1.0)/(r2+1.0));
    float rotX  = t*0.1*strength;
    float c = cos(rotX), s = sin(rotX);
    sphere.yz = mat2(c,-s,s,c)*sphere.yz;
    float backProj = 1.0/(1.0-sphere.z+0.01);
    return vec2(sphere.x*backProj, sphere.y*backProj)*0.5+0.5;
}

// =====================================================================
// MAIN
// =====================================================================
void main() {
    vec2 uv = vUV;
    float intensity = smoothstep(0.0,0.2,uProgress)*mix(1.0,1.5,uBeatStrength);

    // Time dilation warp
    uv = timeDilationWarp(uv, uTime, uProgress*0.6);

    // Glitch UV (multi-layer)
    float glitchAmt = intensity*(0.4+uBeatStrength*0.3);
    vec2 glitchedUV = glitchUV(uv, uTime, glitchAmt);

    // Inverse stereographic warp (late scene)
    vec2 stereoUV = inverseStereo(glitchedUV, uTime, smoothstep(0.6,1.0,uProgress)*0.4);
    glitchedUV = mix(glitchedUV, stereoUV, smoothstep(0.5,0.9,uProgress));

    // Julia set base (beat-influenced parameter)
    float beatInfluence = uBeatStrength*0.3;
    vec2 juliaC = vec2(
        -0.7 + sin(uTime*0.2+beatInfluence)*0.3,
         0.27+ cos(uTime*0.3)*0.2
    );
    vec2 z = (glitchedUV*2.0-1.0)*2.5;
    z.x *= uResolution.x/uResolution.y;
    JuliaResult jr = julia(z, juliaC, 64);

    // Second Julia (different parameter, shifted space)
    vec2 juliaC2 = vec2(
        -0.4+cos(uTime*0.15)*0.25,
         0.6+sin(uTime*0.25)*0.15
    );
    vec2 z2 = (glitchedUV*2.0-1.0)*1.8;
    JuliaResult jr2 = julia(z2, juliaC2, 48);

    // Kaleidoscope mirror
    int kSegs = 6+int(uProgress*6.0);
    vec2 kUV  = kaleidoscopeNested(glitchedUV, kSegs, 3+int(uProgress*3.0),
                                   uTime*0.05, -uTime*0.03);
    JuliaResult jrK = julia((kUV*2.0-1.0)*2.5, juliaC, 48);

    // Newton fractal (appears mid-scene)
    vec3 newton = newtonFractal((glitchedUV*2.0-1.0)*2.0);
    float newtonMix = smoothstep(0.3,0.7,uProgress)*0.3;

    // Burning ship (chaotic layer)
    float bs = burningShip((glitchedUV*2.0-1.0)*1.5 + vec2(-0.4,-0.2), 32);
    float bsMix = smoothstep(0.5,0.9,uProgress)*0.2;

    // === PRIMARY COLOR ===
    vec3 col = mix(vec3(0.0,0.1,0.4), vec3(0.7,0.0,1.0), jr.smooth_iter);
    col = mix(col, mix(vec3(0.0,0.6,0.5), vec3(1.0,0.2,0.0), jrK.smooth_iter), 0.4);

    // Orbit trap coloring
    vec3 trapA = mix(vec3(0.1,0.5,1.0), vec3(1.0,0.3,0.0), jr.trap.x);
    vec3 trapB = mix(vec3(0.0,1.0,0.5), vec3(0.8,0.0,1.0), jr.trap.y);
    col = mix(col, (trapA+trapB)*0.5, 0.25*uProgress);

    // Second Julia blend
    col = mix(col, mix(vec3(0.2,0.0,0.5), vec3(0.0,0.8,0.5), jr2.smooth_iter), 0.3*uProgress);

    // Newton fractal overlay
    col = mix(col, newton*vec3(1.5,0.8,2.0), newtonMix);

    // Burning ship overlay
    col = mix(col, mix(vec3(0.8,0.1,0.0), vec3(0.2,0.9,0.4), bs), bsMix);

    // === TEMPORAL GHOSTS ===
    col += temporalSlice(glitchedUV, -0.5, 0.15*uProgress);
    col += temporalSlice(glitchedUV, -1.2, 0.10*uProgress);
    col += temporalSlice(glitchedUV,  0.8, 0.12*uProgress);
    col += temporalSlice(glitchedUV, -2.1, 0.07*uProgress);
    col += temporalSlice(glitchedUV,  1.7, 0.06*uProgress);

    // === FEEDBACK ACCUMULATION ===
    float ca = 0.003+uProgress*0.008;
    vec3 feedback  = sampleGlitched(uPrevFrame, glitchedUV+vec2(0.0,0.001), ca);
    vec3 feedback2 = texture(uPrevFrame, glitchedUV*vec2(1.001,1.0)-vec2(0.0005,0.0)).rgb;
    col = mix(col, feedback,  0.30*uProgress);
    col = mix(col, feedback2, 0.08*uProgress);

    // === FRACTURE LINES ===
    float flines = fractureLines(uv, uTime);
    col *= mix(1.0, flines*0.5+0.5, 0.4*uProgress);
    col += vec3(0.5,0.1,1.0)*(1.0-flines)*0.3*uProgress;

    // === SPACETIME CRACKS ===
    float beatBoost = pow(1.0-uBeatPhase, 4.0)*uBeatStrength;
    float cracks = spaceFracture(uv*vec2(uResolution.x/uResolution.y,1.0)*0.5, beatBoost);
    col += cracks*vec3(0.12,0.45,1.00)*(0.7+beatBoost*1.2);
    col += cracks*beatBoost*vec3(0.80,0.90,1.00)*0.5;

    // === PORTAL RINGS ===
    col += portalRing(uv, vec2(0.5,0.5), 0.35, 0.0)*vec3(0.0,0.6,1.0)*1.2*uProgress;
    col += portalRing(uv, vec2(0.3,0.7), 0.18, 0.33)*vec3(1.0,0.2,0.8)*0.8*uProgress;
    col += portalRing(uv, vec2(0.7,0.3), 0.22, 0.67)*vec3(0.2,1.0,0.5)*0.6*uProgress;
    col += portalRing(uv, vec2(0.2,0.4), 0.12, 0.15)*vec3(1.0,0.5,0.0)*0.5*uProgress;

    // === WORMHOLE CENTER ===
    float wormholeStr = smoothstep(0.5,1.0,uProgress);
    vec3  wh  = wormhole(uv, uTime);
    col = mix(col, wh, wormholeStr*0.4);

    // === BEAT FLASH ===
    float beatFlash = pow(1.0-uBeatPhase, 6.0)*uBeatStrength;
    col += vec3(1.0,0.3,0.8)*beatFlash*0.8;
    col = mix(col, vec3(1.0), beatFlash*0.15*(uBeatStrength>0.9?1.0:0.0));

    // === BPM PULSE RING ===
    float bpmRing = abs(length(uv-0.5) - fract(uTime*133.0/60.0/4.0)*0.8);
    col += exp(-bpmRing*30.0)*uBeatStrength*0.3*vec3(0.3,0.6,1.0);

    // === SCANLINES (mild) ===
    col *= 0.92+0.08*sin(gl_FragCoord.y*2.0);

    // === VIGNETTE + CHROMATIC EDGE ===
    vec2  edge = (uv-0.5)*2.0;
    float vign = 1.0-dot(edge,edge)*0.35;
    col *= vign;

    // Chromatic aberration at edges
    float edgeCa = dot(edge,edge)*0.008*uProgress;
    col.r = mix(col.r, texture(uPrevFrame, uv+vec2(edgeCa,0)).r, 0.2);
    col.b = mix(col.b, texture(uPrevFrame, uv-vec2(edgeCa,0)).b, 0.2);

    fragColor = vec4(col, 1.0);
}
