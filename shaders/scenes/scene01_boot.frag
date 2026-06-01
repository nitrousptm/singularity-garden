#version 460 core
// SCENE 1: BOOT — CRT Startup (0:00-0:20, 133 BPM)
// 4 Phasen: POWER_ON → HEX_MATERIALIZE → DATA_CASCADE → SYSTEM_ONLINE
// Extended: multi-layer hex grids, branching circuit traces, recursive mandala,
//           fractal noise fields, advanced BPM reactions, 12-layer data streams

#include "../common/noise.glsl"
#include "../common/sdf.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uSceneTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uBeatStrength;
uniform float uHolyShitPhase;
uniform int   uBeat;
uniform vec2  uResolution;

#define PHASE_POWER  0.14
#define PHASE_HEX    0.38
#define PHASE_DATA   0.68
#define PI  3.14159265359
#define TAU 6.28318530718

// =====================================================================
// MATH UTILS
// =====================================================================
float easeIn(float t)    { return t * t; }
float easeOut(float t)   { return 1.0 - (1.0-t)*(1.0-t); }
float easeInOut(float t) { return t * t * (3.0 - 2.0 * t); }
float easeInCubic(float t)  { return t*t*t; }
float easeOutCubic(float t) { float u=1.0-t; return 1.0-u*u*u; }
float pulse(float t, float w) { return smoothstep(0.0,w,t)*smoothstep(2.0*w,w,t); }

// Interleaved gradient noise for dithering
float ign(vec2 c) { return fract(52.9829189*fract(dot(c,vec2(0.06711056,0.00583715)))); }

// =====================================================================
// HASH / NOISE (extended set)
// =====================================================================
float hash11b(float p) { return fract(sin(p*127.1)*43758.5453); }
float hash12b(vec2  p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec2  hash22b(vec2  p) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),
                          dot(p,vec2(269.5,183.3))))*43758.5453);
}
vec3  hash31b(vec3 p) {
    p = fract(p*vec3(443.8975,397.2973,491.1871));
    p += dot(p.yzx, p+19.19);
    return fract((p.xxy+p.yxx)*p.zyx);
}

// 2D value noise (smooth)
float vnoise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash12b(i),          hash12b(i+vec2(1,0)), f.x),
               mix(hash12b(i+vec2(0,1)), hash12b(i+vec2(1,1)), f.x), f.y);
}

// 3D value noise
float vnoise3b(vec3 p) {
    vec3 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(
        mix(mix(hash11b(dot(i,          vec3(1,57,113))),
                hash11b(dot(i+vec3(1,0,0),vec3(1,57,113))),f.x),
            mix(hash11b(dot(i+vec3(0,1,0),vec3(1,57,113))),
                hash11b(dot(i+vec3(1,1,0),vec3(1,57,113))),f.x),f.y),
        mix(mix(hash11b(dot(i+vec3(0,0,1),vec3(1,57,113))),
                hash11b(dot(i+vec3(1,0,1),vec3(1,57,113))),f.x),
            mix(hash11b(dot(i+vec3(0,1,1),vec3(1,57,113))),
                hash11b(dot(i+vec3(1,1,1),vec3(1,57,113))),f.x),f.y),f.z);
}

// Fractal Brownian Motion 2D (6 octaves)
float fbm2b(vec2 p) {
    float v=0.0, a=0.5;
    mat2 rot=mat2(0.8,0.6,-0.6,0.8);
    for(int i=0;i<6;i++){ v+=a*vnoise2(p); p=rot*p*2.07+vec2(0.9,1.7); a*=0.5; }
    return v;
}

// Fractal Brownian Motion 3D (5 octaves)
float fbm3b(vec3 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*vnoise3b(p); p=p*2.1+vec3(0.9,1.7,2.3); a*=0.5; }
    return v;
}

// Domain-warped FBM
float dwfbm2(vec2 p, float warpAmt) {
    vec2 q = vec2(fbm2b(p), fbm2b(p+vec2(5.2,1.3)));
    vec2 r = vec2(fbm2b(p+q*warpAmt), fbm2b(p+q*warpAmt+vec2(1.7,9.2)));
    return fbm2b(p + r*warpAmt);
}

// =====================================================================
// CRT / DISPLAY EFFECTS
// =====================================================================
vec2 crtDistort(vec2 uv, float strength) {
    uv = uv*2.0-1.0;
    float r2 = dot(uv,uv);
    uv *= 1.0 + r2*(strength + r2*strength*0.18);
    return uv*0.5+0.5;
}

// Multi-frequency phosphor grid (sharp RGB sub-pixels)
float scanline(vec2 uv, float intensity) {
    float sl  = sin(uv.y*uResolution.y*PI*0.5)*0.5+0.5;
    float ph  = sin(uv.x*uResolution.x*PI*0.5)*0.5+0.5;
    float sl2 = sin(uv.y*uResolution.y*PI*1.5)*0.5+0.5;
    return mix(1.0, sl*(0.72+ph*0.20)+sl2*0.08, intensity);
}

// Vertical edge burn (phosphor fade at screen edges)
float edgeBurn(vec2 uv) {
    vec2 e = uv*(1.0-uv);
    return clamp(e.x*e.y*25.0, 0.0, 1.0);
}

// RGB phosphor mask simulation (tricolor dots)
vec3 phosphorMask(vec2 uv, float strength) {
    float px = uResolution.x;
    float subpix = fract(uv.x * px * 3.0);
    float rMask = smoothstep(0.66, 0.34, abs(subpix - 0.165));
    float gMask = smoothstep(0.66, 0.34, abs(subpix - 0.500));
    float bMask = smoothstep(0.66, 0.34, abs(subpix - 0.835));
    return mix(vec3(1.0), vec3(rMask,gMask,bMask)*1.3, strength);
}

// Boot scanline sweep — dual-beam version
float bootSweep(vec2 uv, float t) {
    float sweepY  = smoothstep(0.0,0.6,t)*1.1-0.05;
    float beam    = exp(-abs(uv.y-sweepY)*120.0);
    float trail   = smoothstep(sweepY-0.08,sweepY,uv.y)*0.2
                  * smoothstep(sweepY,sweepY-0.25,uv.y);
    // Second beam (fainter, offset)
    float sweepY2 = sweepY-0.06;
    float beam2   = exp(-abs(uv.y-sweepY2)*80.0)*0.35;
    float trail2  = smoothstep(sweepY2-0.12,sweepY2,uv.y)*0.12
                  * smoothstep(sweepY2,sweepY2-0.35,uv.y);
    return beam + trail + beam2 + trail2;
}

// =====================================================================
// BPM GLITCH SYSTEM (multi-layer, band + block + chromatic)
// =====================================================================
vec2 bpmGlitch(vec2 uv, float beatPhase, float prog) {
    float onset  = pow(max(0.0, 1.0-beatPhase*4.0), 2.5);
    float power  = onset*0.018*mix(1.0,0.15,smoothstep(0.35,0.85,prog));

    // Row displacement
    float row     = floor(uv.y*20.0);
    float rowHash = hash12b(vec2(row*0.453, float(uBeat)*0.137));
    float glitchRow = step(0.82, rowHash);
    float dir = sign(rowHash-0.91);
    vec2 displaced = vec2(uv.x + power*glitchRow*dir, uv.y);

    // Block corruption
    vec2 block = floor(uv*16.0)/16.0;
    float blockCorrupt = step(0.96, hash12b(block + float(uBeat)*0.073));
    float bShift = (hash12b(block+0.5)-0.5)*0.03*blockCorrupt*onset;
    displaced += vec2(bShift, bShift*0.5);

    // Pixel row jitter (fine-grain)
    float fineRow = floor(uv.y*80.0);
    float fineHash = hash12b(vec2(fineRow*0.317, float(uBeat)*0.211));
    float fineJitter = (fineHash-0.5)*0.003*onset*step(0.91, fineHash);
    displaced.x += fineJitter;

    return displaced;
}

// Chromatic aberration (barrel-form, stronger at edges)
vec3 chromAberration(sampler2D tex, vec2 uv, float strength) {
    // (placeholder — we compute inline instead)
    return vec3(0.0);
}

// =====================================================================
// HEX GRID SYSTEM (7 scale layers)
// =====================================================================
// Returns: x=edge dist, y=center dist, zw=cell ID
vec4 hexCell(vec2 p, float cellSize) {
    const float sq3 = 1.7320508;
    vec2 q = vec2(p.x/(cellSize*sq3), p.y/cellSize - p.x/(cellSize*sq3));
    vec2 pi = floor(q), pf = fract(q);
    float v = mod(pi.x+pi.y, 3.0);
    float ca = step(1.0,v), cb = step(2.0,v);
    vec2  ma = step(pf,pf.yx);
    vec2  id = pi + ca*(1.0-ma) + cb*ma;
    vec2  center = id*vec2(sq3,1.0) + vec2(0.0, mod(id.x,2.0)*0.5);
    vec2  r  = p - center*cellSize;
    vec2  ra = abs(r);
    float edgeDist   = max(dot(ra, normalize(vec2(1.0,sq3))), ra.x) - cellSize*0.5;
    float centerDist = length(r);
    return vec4(edgeDist, centerDist, id);
}

// Hex activation wave from center
float hexActivated(vec2 uv, float cellSize, float wave) {
    float dist       = length(uv-0.5);
    float activation = smoothstep(wave-0.06, wave+0.18, 0.85-dist);
    vec4  h          = hexCell((uv-0.5)*2.0, cellSize*0.1);
    float edge       = smoothstep(0.0, 0.04, -h.x);
    return edge * activation;
}

// Multi-scale hex composite (7 layers)
vec3 hexMultiLayer(vec2 uv, float prog, float beatBoost) {
    vec3 col = vec3(0.0);
    float waveFront = smoothstep(PHASE_POWER, PHASE_HEX+0.08, prog)*0.82;

    // Layer 1 — fine (primary grid)
    float h1 = hexActivated(uv, 15.0, waveFront);
    col += vec3(0.0, 0.75, 0.4) * h1 * 0.65 * (1.0+beatBoost);

    // Layer 2 — medium
    float h2 = hexActivated(uv, 5.5, waveFront*0.88);
    col += vec3(0.0, 0.28, 0.62) * h2 * 0.55 * (1.0+beatBoost*0.7);

    // Layer 3 — large structural
    float h3 = hexActivated(uv, 2.5, waveFront*0.72);
    col += vec3(0.03, 0.12, 0.35) * h3 * 0.30;

    // Layer 4 — micro-detail
    float h4 = hexActivated(uv, 30.0, waveFront*1.05);
    col += vec3(0.0, 0.45, 0.65) * h4 * 0.25 * prog;

    // Layer 5 — secondary offset grid
    vec2 uvOff = uv + vec2(0.03, 0.0);
    float h5 = hexActivated(uvOff, 18.0, waveFront*0.95);
    col += vec3(0.0, 0.55, 0.30) * h5 * 0.20 * prog;

    // Layer 6 — tertiary (large, structural backbone)
    float h6 = hexActivated(uv, 1.2, waveFront*0.55);
    col += vec3(0.02, 0.06, 0.18) * h6 * 0.15;

    // Layer 7 — beat-reactive overlay
    float h7 = hexActivated(uv, 8.0, waveFront*0.90+beatBoost*0.05);
    col += vec3(0.1, 0.5, 1.0) * h7 * 0.15 * beatBoost;

    return col;
}

// BPM ripple from center
float beatRipple(vec2 uv, float beatPhase, float beatStrength) {
    float dist = length(uv-0.5);
    float front = beatPhase*0.75;
    float ring  = exp(-abs(dist-front)*30.0)*(1.0-beatPhase)*beatStrength;
    // Secondary ring (half-beat)
    float front2 = fract(beatPhase*2.0)*0.75*0.5;
    float ring2  = exp(-abs(dist-front2)*50.0)*(1.0-fract(beatPhase*2.0))*beatStrength*0.4;
    return ring + ring2;
}

// =====================================================================
// ELECTRIC ARC SYSTEM (multi-generation)
// =====================================================================
float electricArc(vec2 uv, float t, float seed) {
    float col   = floor(uv.x*28.0 + seed*7.3);
    float row   = floor(uv.y*16.0 + seed*3.1);
    float cell  = hash11b(col*0.3713 + row*0.1879 + seed);
    float isAct = step(0.72, fract(cell + floor(t*3.0)*0.073));

    float lx    = fract(uv.x*28.0 + seed*7.3);
    float ly    = fract(uv.y*16.0 + seed*3.1);
    float noise = sin(lx*60.0 + t*25.0 + cell*TAU)*0.12;
    float arcH  = exp(-abs(ly-0.5+noise)*18.0);
    arcH *= step(0.06,lx)*step(lx,0.94);

    // Secondary arc (perpendicular)
    float nV    = sin(ly*60.0 + t*22.0 + cell*TAU)*0.10;
    float arcV  = exp(-abs(lx-0.5+nV)*20.0);
    arcV *= step(0.08,ly)*step(ly,0.92);

    return isAct*(arcH + arcV*0.4);
}

// Branching arc (L-system-like)
float branchArc(vec2 uv, float seed, float t, float prog) {
    float acc  = 0.0;
    vec2  p    = hash22b(vec2(seed, 0.1))*2.0-1.0;
    vec2  d    = normalize(hash22b(vec2(seed, 0.2))*2.0-1.0);

    for(int i=0; i<8; i++) {
        float fi   = float(i);
        float len  = 0.08 + hash11b(seed*7.3+fi)*0.12;
        vec2  next = p + d*len;

        // Line segment SDF
        vec2  pa = uv - p, ba = next - p;
        float h  = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
        float sd = length(pa - ba*h);
        float w  = 0.002*pow(0.8, fi);
        acc += w/(sd+w);

        // Branch
        if(hash11b(seed*3.1+fi) > 0.55) {
            float ang   = (hash11b(seed*1.7+fi)-0.5)*1.4;
            vec2  bdir  = normalize(vec2(d.x*cos(ang)-d.y*sin(ang),
                                        d.x*sin(ang)+d.y*cos(ang)));
            vec2  bend  = p + bdir*len*0.5;
            vec2  pab   = uv-p, bab = bend-p;
            float hb    = clamp(dot(pab,bab)/dot(bab,bab),0.0,1.0);
            float sdb   = length(pab - bab*hb);
            acc += (w*0.5)/(sdb+w*0.5)*0.6;
        }

        float angle = (hash11b(seed*2.3+fi)-0.5)*0.7;
        d = normalize(vec2(d.x*cos(angle)-d.y*sin(angle),
                           d.x*sin(angle)+d.y*cos(angle)));
        p = next;
    }
    return acc * prog;
}

// =====================================================================
// DATA STREAM SYSTEM (12 layers, beat-reactive)
// =====================================================================
float dataStream(vec2 uv, float t, float beatBoost, float seed) {
    float col    = floor(uv.x*50.0+seed);
    float speed  = hash11b(col*0.137+seed)*9.0+4.0;
    float offset = hash11b(col*0.3719+seed)*25.0;
    speed *= 1.0+beatBoost*2.5*hash11b(col*0.571+seed);

    float y    = fract(uv.y - t*speed*0.10+offset);
    float x    = fract(uv.x*50.0+seed);
    float cell = col*300.0+floor(y*80.0);
    float ch   = step(0.38, hash11b(cell+floor(t*4.0)*0.11));

    float outline  = step(0.07,x)*step(x,0.93)*step(0.04,y)*step(y,0.96);
    float fade     = pow(1.0-abs(y*2.0-1.0), 1.8);
    float colBurst = smoothstep(0.0,0.15,beatBoost)*hash11b(col*0.419+floor(t)*0.07);
    return (ch*outline*fade + colBurst*0.25)*outline;
}

// Cascading data waterfall (multiple overlapping streams)
vec3 dataCascade(vec2 uv, float t, float dataPhase, float beatBoost) {
    vec3 col = vec3(0.0);
    float ca = 0.006*(1.0-dataPhase*0.8);

    // Layer A — primary (green matrix)
    float ds_r = dataStream(uv+vec2(ca,0), t*0.45, beatBoost, 0.0);
    float ds_g = dataStream(uv,            t*0.45, beatBoost, 0.0);
    float ds_b = dataStream(uv-vec2(ca,0), t*0.45, beatBoost, 0.0);
    col += vec3(ds_r, ds_g, ds_b)*vec3(0.05, 0.95, 0.30)*0.9;

    // Layer B — slower blue
    float ds2  = dataStream(uv*0.65, t*0.28+80.0, beatBoost*0.5, 3.7);
    col += ds2*vec3(0.0, 0.35, 0.85)*0.45;

    // Layer C — fast red noise
    float ds3  = dataStream(uv*1.4, t*0.62+30.0, beatBoost*0.8, 7.1);
    col += ds3*vec3(0.8, 0.1, 0.2)*0.25*dataPhase;

    // Layer D — wide columns (very fast)
    float ds4  = dataStream(uv*0.3+vec2(0.1,0.0), t*0.85+50.0, beatBoost, 12.4);
    col += ds4*vec3(0.2, 0.6, 1.0)*0.30*dataPhase;

    // Layer E — diagonal shimmer (horizontal offset with time)
    vec2 diagUV = uv + vec2(t*0.02, 0.0);
    float ds5   = dataStream(diagUV, t*0.35+90.0, beatBoost*0.3, 18.9);
    col += ds5*vec3(0.6, 0.9, 0.3)*0.20*dataPhase;

    // Layer F — mirrored stream (flows upward)
    float ds6 = dataStream(vec2(uv.x, 1.0-uv.y), t*0.4+40.0, beatBoost*0.6, 5.3);
    col += ds6*vec3(0.0, 0.55, 0.7)*0.18*dataPhase;

    return col*dataPhase;
}

// =====================================================================
// CIRCUIT TRACE NETWORK
// =====================================================================
float circuitTrace(vec2 uv, float seed, float t, float prog) {
    float acc = 0.0;
    vec2  p   = hash22b(vec2(seed, 0.1))*2.4-1.2;

    for(int i=0; i<10; i++) {
        float fi  = float(i);
        // Orthogonal direction (0=H, 1=V)
        float isV = step(0.5, hash11b(seed*2.7+fi));
        float len = 0.05+hash11b(seed*1.3+fi)*0.25;
        float progress = fract(t*0.3+seed+fi*0.1)*len;

        vec2 dir  = isV < 0.5 ? vec2(1,0) : vec2(0,1);
        vec2 next = p + dir*progress;

        vec2 pa  = uv-p, ba = next-p;
        float h  = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
        float sd = length(pa-ba*h);
        float w  = 0.0015*pow(0.9,fi);
        acc += w/(sd+w);

        // Junction solder dot
        float jd = length(uv-p);
        acc += 0.005/(jd*jd+0.005*0.005)*0.3;

        // 90° turn
        p = next;
        float turnChance = hash11b(seed*5.1+fi);
        if(turnChance > 0.4) {
            dir = isV < 0.5 ? vec2(0,1) : vec2(1,0);
        }
    }
    return acc*prog;
}

// Full circuit board
float circuitBoard(vec2 uv, float t, float prog) {
    float acc = 0.0;
    for(int i=0; i<20; i++) {
        acc += circuitTrace(uv, float(i)*0.17, t, prog);
    }
    return min(acc, 1.0);
}

// =====================================================================
// CORE MANDALA — recursive, multi-ring
// =====================================================================
float coreMandala(vec2 uv, float t, float progress) {
    vec2  c   = uv-0.5;
    float r   = length(c);
    float ang = atan(c.y,c.x);

    float segs    = 6.0;
    float segStep = TAU/segs;

    // Ring 1
    float ring1 = smoothstep(0.006,0.0,abs(r-0.065));
    // Ring 2
    float ring2 = smoothstep(0.004,0.0,abs(r-0.115));
    // Ring 3
    float ring3 = smoothstep(0.005,0.0,abs(r-0.175));
    // Ring 4 (new)
    float ring4 = smoothstep(0.003,0.0,abs(r-0.225));
    // Ring 5 (new)
    float ring5 = smoothstep(0.0025,0.0,abs(r-0.260));

    // Forward spokes
    float spFwd  = fract(ang/segStep + t*0.18)*2.0-1.0;
    float spBwd  = fract(ang/segStep - t*0.12)*2.0-1.0;
    float spokeF = smoothstep(0.12,0.0,abs(spFwd)*r*6.0);
    float spokeB = smoothstep(0.12,0.0,abs(spBwd)*r*6.0);

    // Diagonal spokes (12-fold)
    float seg12   = TAU/12.0;
    float sp12Fwd = fract(ang/seg12 + t*0.24)*2.0-1.0;
    float spoke12 = smoothstep(0.08,0.0,abs(sp12Fwd)*r*8.0)*0.6;

    // Inner petal pattern (6 petals)
    float petalAng = mod(ang, segStep)/segStep*TAU;
    float petal    = smoothstep(0.02,0.0,abs(sin(petalAng*3.0)*0.04-r+0.12))*step(r,0.15);

    // Outer flower pattern
    float outerAng  = mod(ang + t*0.05, segStep)/segStep*TAU;
    float outerPetal = smoothstep(0.015,0.0,abs(sin(outerAng*3.0)*0.06-r+0.21))*step(r,0.24);

    // Metatron cube lines
    float cubeLine = 0.0;
    for(int i=0; i<6; i++) {
        float fa  = float(i)*segStep;
        vec2  vA  = vec2(cos(fa), sin(fa))*0.175;
        vec2  vB  = vec2(cos(fa+segStep), sin(fa+segStep))*0.175;
        vec2  pa  = c-vA, ba = vB-vA;
        float h   = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
        float ld  = length(pa-ba*h);
        cubeLine += smoothstep(0.005,0.0,ld)*0.5;
    }

    float shape = max(max(max(ring1,ring2),max(ring3,ring4)),
                  max(ring5, max(max(spokeF,spokeB),max(spoke12,petal))));
    shape = max(shape, max(outerPetal, cubeLine));

    return shape * smoothstep(0.28,0.55,progress)*step(r,0.28);
}

// =====================================================================
// STATIC / NOISE FIELD
// =====================================================================
float analogStatic(vec2 uv, float t, float prog) {
    // Slow noise
    float n1 = fbm2b(uv*8.0 + t*0.2)*0.5+0.5;
    // Fast grain
    float n2 = hash12b(uv*uResolution + vec2(t*77.3, t*47.1))-0.5;
    // Vertical noise bands (CRT interference)
    float bands = sin(uv.y*uResolution.y*0.7 + t*60.0)*0.5+0.5;
    bands *= hash11b(floor(uv.y*uResolution.y*0.7 + t*60.0)*0.1);
    return (n1*0.4 + n2*0.3 + bands*0.3) * (1.0-prog);
}

// =====================================================================
// MAIN
// =====================================================================
void main() {
    float beatPulse = pow(max(0.0, 1.0-uBeatPhase*2.8), 2.0)*uBeatStrength;
    float barPulse  = pow(max(0.0, 1.0-uBarPhase*5.0),  3.0)*uBeatStrength;

    // CRT distortion (fading with progress)
    float crtStr    = mix(0.048, 0.016, smoothstep(0.2,0.75,uProgress));
    vec2  glitchUV  = bpmGlitch(vUV, uBeatPhase, uProgress);
    vec2  uv        = crtDistort(glitchUV, crtStr);

    if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) { fragColor=vec4(0.0); return; }

    float powerOn   = smoothstep(0.0,     PHASE_POWER, uProgress);
    float hexPhase  = smoothstep(PHASE_POWER, PHASE_HEX,  uProgress);
    float dataPhase = smoothstep(PHASE_HEX,   PHASE_DATA, uProgress);
    float online    = smoothstep(PHASE_DATA,  1.0,        uProgress);

    vec2 cUV = uv-0.5;

    // === LAYER 1: VOID BACKGROUND ===
    float bgNoise = fbm2b(uv*3.0 + uTime*0.05)*0.006;
    float bgNoise2= dwfbm2(uv*1.5, 1.0)*0.004;
    vec3  col = vec3(0.0, 0.008, 0.018)*powerOn + bgNoise + bgNoise2;

    // === LAYER 2: BOOT-SWEEP (dual beam) ===
    float sweep = bootSweep(uv, uSceneTime*2.8);
    col += vec3(0.0, 0.9, 0.5)*sweep*(1.0-hexPhase);
    col += vec3(0.1, 0.55, 1.0)*sweep*hexPhase*0.35;

    // === LAYER 3: MULTI-SCALE HEX GRID ===
    float hexBeat = 1.0+beatPulse*1.0;
    col += hexMultiLayer(uv, uProgress, beatPulse);

    // Beat ripple
    float ripple  = beatRipple(uv, uBeatPhase, uBeatStrength);
    float ripple2 = beatRipple(uv, fract(uBeatPhase+0.5), uBeatStrength*0.6);
    col += vec3(0.0, 0.55, 0.9)*(ripple+ripple2*0.4)*0.5*hexPhase;

    // === LAYER 4: ELECTRIC ARC NETWORK ===
    float arc1 = electricArc(uv, uTime, 0.0);
    float arc2 = electricArc(uv, uTime, 5.3);
    float arc3 = electricArc(uv, uTime, 11.7);
    float arcFade = hexPhase*(1.0-online*0.8);
    col += vec3(0.25, 0.85, 1.0)*(arc1+arc2)*0.9*arcFade;
    col += vec3(0.8, 0.4, 1.0)*arc3*0.5*arcFade*dataPhase;

    // === LAYER 5: CIRCUIT TRACES ===
    float circuits = circuitBoard(uv*2.0-1.0, uTime, hexPhase);
    col += circuits*vec3(0.1, 0.6, 0.3)*0.8*hexPhase;
    col += circuits*beatPulse*vec3(0.3, 0.9, 0.5)*0.4;

    // === LAYER 6: BRANCHING ARCS ===
    float barcs = 0.0;
    for(int i=0; i<8; i++) {
        barcs += branchArc(uv*2.0-1.0, float(i)*0.37, uTime, hexPhase);
    }
    col += barcs*vec3(0.1, 0.45, 1.0)*0.6*hexPhase;

    // === LAYER 7: DATA CASCADE ===
    col += dataCascade(uv, uTime, dataPhase, beatPulse);

    // === LAYER 8: CORE MANDALA (multi-ring) ===
    float mandala = coreMandala(uv, uTime, uProgress);
    float coreR   = length(cUV);

    // Multi-layer core glow
    float coreGlow1 = exp(-coreR*11.0)*smoothstep(0.22,0.72,uProgress)*(0.5+beatPulse*0.5);
    float coreGlow2 = exp(-coreR*4.5)*online*0.35;
    float coreGlow3 = exp(-coreR*22.0)*beatPulse*1.5;
    float coreGlow4 = exp(-coreR*2.0)*online*0.15;

    // Mandala color cycling
    vec3 mandalaCol = mix(
        mix(vec3(0.0,0.85,1.0), vec3(0.3,0.3,1.0), uBarPhase),
        vec3(0.6,0.1,1.0), online*0.4);
    vec3 coreCol2  = mix(vec3(0.0,1.0,0.6), vec3(1.0,0.5,0.0), uBarPhase*0.8);

    col += mandalaCol*mandala*2.2;
    col += vec3(0.0,0.72,1.0)*coreGlow1;
    col += vec3(0.08,0.35,0.85)*coreGlow2;
    col += coreCol2*coreGlow3;
    col += vec3(0.0,0.4,0.8)*coreGlow4;

    // Rotating inner glow ring
    float innerRing = smoothstep(0.003,0.0,abs(coreR-0.04*(1.0+sin(uTime*3.0)*0.2)));
    col += innerRing*mix(vec3(0.3,0.8,1.0), vec3(1.0,0.5,0.2), uBarPhase)*3.0*online;

    // === LAYER 9: NOISE FIELD / STATIC ===
    float staticN = analogStatic(uv, uTime, uProgress);
    col += staticN*vec3(0.2,0.9,0.5)*(1.0-uProgress*0.9);

    // FBM texture overlay
    float fbmOver = fbm3b(vec3(uv*4.0, uTime*0.1))*0.03*hexPhase;
    col += fbmOver*vec3(0.0,0.4,0.8);

    // === LAYER 10: BAR + BEAT FLASH ===
    float barFlash  = barPulse*0.3*online;
    float beatFlash = beatPulse*0.15*hexPhase;
    vec3  flashCol  = mix(vec3(0.0,0.5,1.0), vec3(0.4,0.1,1.0), uBarPhase);
    col += flashCol*(barFlash+beatFlash);

    // === LAYER 11: SCANLINES + PHOSPHOR MASK ===
    float slIntensity = mix(0.75, 0.30, smoothstep(PHASE_DATA,1.0,uProgress));
    col *= scanline(uv, slIntensity);
    col *= phosphorMask(uv, 0.06*powerOn);

    // === LAYER 12: CRT VIGNETTE + EDGE BURN ===
    float vign = dot(cUV*1.55, cUV*1.55);
    col *= clamp(1.0-vign*vign, 0.0, 1.0);
    col *= edgeBurn(uv);

    // === LAYER 13: FILM GRAIN (multi-scale) ===
    float grain1 = hash12b(uv + vec2(uTime*0.041, uTime*0.083))-0.5;
    float grain2 = hash12b(uv*2.3 + vec2(uTime*0.11, uTime*0.07))-0.5;
    float grainAmt = mix(0.055,0.012,smoothstep(0.3,0.85,uProgress));
    col += (grain1*0.7 + grain2*0.3)*grainAmt*powerOn;

    // === PHOSPHOR TINT ===
    vec3 tint = mix(vec3(0.85,1.0,0.90), vec3(0.95,0.98,1.0), online);
    col = mix(col, col*tint, 0.28*powerOn);

    // === HOLY-SHIT MOMENT ===
    if(uHolyShitPhase > 0.001) {
        float hs = uHolyShitPhase;

        // All hex cells fire simultaneously
        float allHex = hexMultiLayer(uv, 1.0, 1.0).g * hs * 4.0;
        col += vec3(0.0,0.8,1.0)*allHex;

        // Mandala explodes outward
        float hsCore = exp(-coreR*(8.0-hs*6.0))*hs*2.5;
        col += mix(vec3(0.0,0.8,1.0), vec3(1.0), hs)*hsCore;

        // Cross-beam burst
        float beam1 = exp(-abs(cUV.y)*(80.0-hs*75.0))*hs*0.8;
        float beam2 = exp(-abs(cUV.x)*(80.0-hs*75.0))*hs*0.8;
        float beam3 = exp(-abs(cUV.y-cUV.x)*(60.0-hs*55.0))*hs*0.4;
        float beam4 = exp(-abs(cUV.y+cUV.x)*(60.0-hs*55.0))*hs*0.4;
        col += vec3(0.5,0.9,1.0)*(beam1+beam2+beam3+beam4);

        // Data streams go haywire
        col += dataCascade(uv, uTime*2.0, 1.0, 1.0)*hs;

        // Scanlines vanish
        col = mix(col, col/scanline(uv,slIntensity), hs*0.7);

        // Color shift to pure cyan-white
        col = mix(col, col*vec3(0.85,1.0,1.0)*(1.0+hs), hs*0.4);
    }

    // Tone mapping (soft)
    col = col / (col + 0.7) * 1.3;

    fragColor = vec4(col, 1.0);
}
