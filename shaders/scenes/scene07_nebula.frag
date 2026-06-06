#version 460 core
// SCENE 7 BACKGROUND: Volumetric Nebula + God Rays + Galactic Structure
// Extended: multi-species nebula, 32-ray god rays, dark matter filaments,
//           parallax star field, planetary nebulae, supernova remnants

#include "../common/noise.glsl"
#include "../common/pbr.glsl"

in  vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform float uProgress;
uniform float uBeatPhase;
uniform float uBeatStrength;
uniform vec2  uResolution;

#define PI  3.14159265359
#define TAU 6.28318530718

// =====================================================================
// MATH UTILS
// =====================================================================
float h11(float p) { return fract(sin(p*127.1)*43758.5453); }
float h12(vec2 p)  { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3  h13(vec3 p)  {
    p=fract(p*vec3(443.8975,397.2973,491.1871));
    p+=dot(p.yzx,p+19.19);
    return fract((p.xxy+p.yxx)*p.zyx);
}

float vn3(vec3 p) {
    vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(
        mix(mix(h11(dot(i,vec3(1,57,113))),h11(dot(i+vec3(1,0,0),vec3(1,57,113))),f.x),
            mix(h11(dot(i+vec3(0,1,0),vec3(1,57,113))),h11(dot(i+vec3(1,1,0),vec3(1,57,113))),f.x),f.y),
        mix(mix(h11(dot(i+vec3(0,0,1),vec3(1,57,113))),h11(dot(i+vec3(1,0,1),vec3(1,57,113))),f.x),
            mix(h11(dot(i+vec3(0,1,1),vec3(1,57,113))),h11(dot(i+vec3(1,1,1),vec3(1,57,113))),f.x),f.y),f.z);
}

float fbm3(vec3 p, int oct) {
    float v=0.0,a=0.5;
    for(int i=0;i<oct;i++){v+=a*vn3(p);p=p*2.1+vec3(0.9,1.7,2.3);a*=0.5;}
    return v;
}

// Domain-warped 3D FBM
float dwfbm3(vec3 p, int oct) {
    vec3 q = vec3(fbm3(p+vec3(0.0,0.0,0.0),3),
                  fbm3(p+vec3(5.2,1.3,2.7),3),
                  fbm3(p+vec3(1.8,9.2,3.1),3));
    vec3 r = vec3(fbm3(p+q+vec3(1.7,9.2,0.0),3),
                  fbm3(p+q+vec3(8.3,2.8,1.3),3),
                  fbm3(p+q+vec3(3.1,7.4,5.6),3));
    return fbm3(p+r, oct);
}

// =====================================================================
// STAR FIELD (6-layer parallax)
// =====================================================================
// Point star with diffraction spikes
float starDiffraction(vec2 p, float size, float t, float seed) {
    float d = length(p);
    float core = size/(d+size);

    // 4 diffraction spikes
    float spikes = 0.0;
    for(int i=0; i<4; i++) {
        float ang  = float(i)*PI*0.5;
        float proj = abs(dot(p, vec2(cos(ang), sin(ang))));
        float orth = abs(dot(p, vec2(-sin(ang), cos(ang))));
        spikes += exp(-proj*proj*800.0)*exp(-orth*orth*50.0)*0.5;
    }
    float twinkle = 0.75+0.25*sin(t*(1.5+seed*4.0)+seed*40.0);
    return (core + spikes)*twinkle;
}

vec3 starField(vec2 uv, float layer) {
    float scale = mix(200.0, 2000.0, layer/5.0);
    vec2  scUV  = uv*scale;
    vec2  id    = floor(scUV);
    vec2  fr    = fract(scUV)-0.5;

    vec3  h  = h13(vec3(id, layer));
    float sz = h.x*mix(0.0012,0.003,layer/5.0);

    float s = starDiffraction(fr, sz, uTime, h.y);
    vec3  c = mix(vec3(0.7,0.85,1.0), vec3(1.0,0.95,0.7), h.z);

    // Only ~15% of cells have stars
    float density = step(0.85, h.x);
    return c*s*density;
}

vec3 allStars(vec2 uv) {
    vec3 col = vec3(0.0);
    for(float l=0.0; l<6.0; l++)
        col += starField(uv, l)*mix(0.6,1.2,l/5.0);
    return col;
}

// =====================================================================
// NEBULA SPECIES
// =====================================================================

// Emission nebula (HII region — ionized hydrogen, red/pink)
float emissionNebula(vec3 rd, float t) {
    float d1 = dwfbm3(rd*1.8 + vec3(t*0.008, 0.0, t*0.005), 6);
    float d2 = fbm3(rd*3.5  + vec3(12.0, t*0.012, 7.3), 4);
    float fil = pow(max(0.0, d1-0.35), 1.8);
    float hii = pow(max(0.0, d2-0.42), 2.5);
    return fil*0.7 + hii*0.4;
}

// Reflection nebula (scatters starlight — blue/white)
float reflectionNebula(vec3 rd, float t) {
    float d = fbm3(rd*2.5 + vec3(t*0.006, 5.1, 2.3), 5);
    float thin = fbm3(rd*5.0 + vec3(3.7, t*0.010, 8.4), 3);
    return pow(max(0.0, d-0.30), 1.5)*0.8 + pow(max(0.0, thin-0.45), 2.0)*0.3;
}

// Dark nebula (extinction — absorbs light)
float darkNebula(vec3 rd, float t) {
    float d = dwfbm3(rd*1.2 + vec3(7.3, t*0.004, t*0.007), 4);
    return smoothstep(0.4, 0.7, d);
}

// Planetary nebula (shell + core)
float planetaryNebula(vec2 uv, vec2 center, float r, float t) {
    vec2  p   = uv-center;
    float d   = length(p);
    // Outer shell
    float shell = smoothstep(0.015,0.0,abs(d-r));
    // Inner bubble
    float inner = smoothstep(0.012,0.0,abs(d-r*0.6));
    // Central star
    float star  = exp(-d*d/(r*r*0.05));
    // Bipolar jets
    float ang   = atan(p.y,p.x);
    float jet1  = exp(-abs(ang)*8.0)*exp(-d*3.0)*step(0.0,cos(ang));
    float jet2  = exp(-abs(ang-PI)*8.0)*exp(-d*3.0)*step(0.0,cos(ang-PI));
    return shell*0.8 + inner*0.5 + star*2.0 + (jet1+jet2)*0.4;
}

// Supernova remnant (shockwave ring with filaments)
float supernovaRemnant(vec2 uv, vec2 center, float r, float t) {
    vec2  p   = uv-center;
    float d   = length(p);
    float ang = atan(p.y,p.x);
    // Expanding shockwave ring
    float ring    = exp(-pow(d-r, 2.0)*200.0);
    // Kelvin-Helmholtz filaments on the shock
    float filAng  = ang*12.0 + vn3(vec3(p*3.0, t*0.1));
    float filaM   = sin(filAng)*0.5+0.5;
    // Bright knots
    float knotH   = h12(vec2(floor(ang*8.0), floor(d*40.0)+floor(t)));
    float knots   = step(0.8, knotH)*ring;
    return ring*filaM*1.5 + knots*2.0;
}

// =====================================================================
// GALACTIC STRUCTURE
// =====================================================================
vec3 galacticSpiral(vec2 uv, float t) {
    vec2  p     = uv-0.5;
    float r     = length(p);
    float theta = atan(p.y,p.x)+t*0.018;

    // 4-arm barred spiral galaxy
    float arms = 0.0;
    for(int i=0; i<4; i++) {
        float offset = float(i)*PI*0.5;
        float phase  = mod(theta + r*5.0 + offset, TAU);
        float arm    = exp(-pow(phase-PI, 2.0)*1.5);
        arms += arm;
    }
    arms *= exp(-r*2.5);

    // Central bar
    float barAngle  = abs(sin(theta))*0.5+0.5;
    float bar       = exp(-r*r*8.0)*barAngle;

    // Bulge
    float bulge = exp(-r*r*25.0)*3.0;

    // Disk
    float disk  = exp(-r*r*2.0)*fbm3(vec3(p*2.0, t*0.005), 3)*0.5;

    vec3 armCol  = mix(vec3(0.3,0.5,1.0), vec3(1.0,0.7,0.3), r*2.0);
    vec3 bulgeCol= vec3(1.0,0.9,0.7);
    vec3 barCol  = vec3(1.0,0.85,0.6);

    return armCol*(arms+disk)*0.4 + bulgeCol*bulge + barCol*bar*0.3;
}

// Dark matter filaments (cosmic web)
float darkMatterFilament(vec2 uv, vec2 a, vec2 b, float thickness) {
    vec2  pa = uv-a, ba = b-a;
    float h  = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    float d  = length(pa-ba*h);
    // Add noise perturbation
    float n  = vn3(vec3(uv*5.0, uTime*0.01))*0.04;
    return exp(-(d+n)*(d+n)/(thickness*thickness))*0.4;
}

vec3 cosmicWeb(vec2 uv) {
    vec3 col = vec3(0.0);
    // Galaxy cluster positions (cosmic web nodes)
    vec2 nodes[6] = vec2[6](
        vec2(0.15, 0.20),
        vec2(0.72, 0.35),
        vec2(0.40, 0.78),
        vec2(0.85, 0.65),
        vec2(0.30, 0.55),
        vec2(0.60, 0.15)
    );
    // Filaments between nodes
    for(int i=0; i<6; i++) {
        for(int j=i+1; j<6; j++) {
            float dist = length(nodes[i]-nodes[j]);
            if(dist < 0.6) {
                float f = darkMatterFilament(uv, nodes[i], nodes[j], 0.012);
                col += f*mix(vec3(0.05,0.03,0.12), vec3(0.10,0.08,0.20), f);
            }
        }
    }
    return col;
}

// =====================================================================
// GOD RAYS SYSTEM (32 rays, variable width + beat)
// =====================================================================
float godRayStreak(vec2 uv, float angle, float width, float t, float beatBoost) {
    vec2 dir  = vec2(cos(angle), sin(angle));
    vec2 perp = vec2(-dir.y, dir.x);
    float along  = dot(uv-0.5, dir);
    float cross_ = dot(uv-0.5, perp);

    // Width modulated by noise along the ray
    float wMod = width*(1.0 + vn3(vec3(along*5.0, angle, t*0.5))*0.4);
    float streak = exp(-cross_*cross_/(wMod*wMod));
    streak *= exp(-abs(along)*1.3)*step(0.0, along);

    // Flicker
    float flicker = 0.65+0.35*sin(t*3.5+angle*4.7);
    // Beat boost
    streak *= 1.0+beatBoost*2.0;

    return streak*flicker;
}

vec3 godRays(vec2 uv, float t, float progress, float beatBoost) {
    vec3 col = vec3(0.0);
    int  numRays = int(8.0+progress*24.0);  // up to 32 rays

    for(int i=0; i<32; i++) {
        if(i >= numRays) break;
        float fi    = float(i);
        float angle = fi*TAU/float(numRays) + t*0.035 + sin(fi*1.7)*0.3;
        float width = 0.008 + 0.025*sin(fi*1.7+t*0.3)*0.5+0.5*0.012;
        float ray   = godRayStreak(uv, angle, max(0.005,width), t, beatBoost);

        // Color per ray (cycles through spectrum)
        float hue = fract(fi/float(numRays) + t*0.02);
        vec3 rayCol = mix(
            mix(vec3(0.3,0.6,1.0), vec3(1.0,0.5,0.2), hue*2.0),
            mix(vec3(1.0,0.5,0.2), vec3(0.6,0.2,1.0), hue*2.0-1.0),
            step(0.5,hue));
        col += rayCol*ray;
    }
    return col*0.6*progress;
}

// =====================================================================
// CENTRAL SINGULARITY
// =====================================================================
vec3 singularity(vec2 uv, float t, float progress, float beatBoost) {
    vec2  p    = uv-0.5;
    float r    = length(p);
    float ang  = atan(p.y, p.x);

    // Event horizon ring
    float horizon = exp(-abs(r-0.03)*80.0);
    // Accretion disk (elliptical glow)
    float diskR   = length(vec2(p.x*1.0, p.y*0.4));
    float disk    = exp(-diskR*diskR*100.0)*smoothstep(0.03,0.02,r);
    // Relativistic jet (bipolar)
    float jet1    = exp(-abs(p.x)*120.0)*exp(-abs(p.y)*5.0)*step(0.0,p.y);
    float jet2    = exp(-abs(p.x)*120.0)*exp(-abs(p.y)*5.0)*step(0.0,-p.y);
    // Hawking radiation flicker
    float hawking = exp(-r*r*200.0)*fract(vn3(vec3(p*20.0,t*2.0))+t)*0.5;

    // Pulse
    float pulse = 1.0+0.4*sin(t*3.0)+0.15*pow(1.0-uBeatPhase,6.0)*uBeatStrength+beatBoost;

    vec3  col = vec3(0.5,0.8,1.0)*horizon*pulse*3.0
              + vec3(1.0,0.6,0.2)*disk*2.0
              + vec3(0.3,0.7,1.0)*(jet1+jet2)*1.5
              + vec3(1.0,1.0,0.8)*hawking;

    // BPM shockwave rings — enhanced
    for(int i=0; i<4; i++) {
        float phase = fract(uTime*133.0/60.0/4.0 + float(i)*0.25)*0.8;
        float ring  = abs(r - phase);
        col += exp(-ring*25.0)*uBeatStrength*0.7*vec3(0.3,0.6,1.0)/float(i+1);
    }

    return col*progress;
}

// =====================================================================
// MAIN
// =====================================================================
void main() {
    vec2 uv  = vUV;
    vec2 ndc = (uv*2.0-1.0);
    ndc.x *= uResolution.x/uResolution.y;

    // Ray direction (slowly rotating)
    float fov = radians(70.0);
    float rot = uTime*0.025;
    vec3 rd   = normalize(vec3(ndc*tan(fov*0.5), -1.0));
    // Slow rotation
    float c = cos(rot), s = sin(rot);
    rd.xz = mat2(c,-s,s,c)*rd.xz;
    // Slight tilt
    float tilt = sin(uTime*0.012)*0.08;
    rd.yz = mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*rd.yz;

    float beatBoost = pow(max(0.0,1.0-uBeatPhase*2.5),2.0)*uBeatStrength;

    // === DEEP SPACE BACKGROUND ===
    vec3 col = vec3(0.0, 0.0, 0.004);

    // === STAR FIELD (6 parallax layers) ===
    col += allStars(uv);

    // === GALACTIC SPIRAL ===
    float gBright = smoothstep(0.0,0.5,uProgress);
    col += galacticSpiral(uv, uTime)*gBright;

    // === COSMIC WEB ===
    col += cosmicWeb(uv)*smoothstep(0.2,0.6,uProgress);

    // === NEBULAE (5 species) ===
    float nBright = uProgress;

    // Emission nebula (red/pink)
    float emN = emissionNebula(rd, uTime);
    col += mix(vec3(0.8,0.1,0.2), vec3(0.9,0.4,0.6), emN)*emN*nBright*0.8;

    // Reflection nebula (blue)
    float rfN = reflectionNebula(rd, uTime);
    col += mix(vec3(0.05,0.10,0.40), vec3(0.20,0.35,0.80), rfN)*rfN*nBright*0.7;

    // Dark nebula (absorption)
    float dkN = darkNebula(rd, uTime);
    col *= 1.0-dkN*0.4*uProgress;

    // OII emission (teal/green, from a second cloud)
    float oii = fbm3(rd*4.2+vec3(9.0,uTime*0.008,3.1), 4);
    col += max(oii-0.45,0.0)*vec3(0.0,0.7,0.5)*nBright*0.5;

    // SII emission (deep red, structured)
    float sii = fbm3(rd*2.8+vec3(uTime*0.006,5.7,1.4), 5);
    col += pow(max(sii-0.5,0.0),2.0)*vec3(0.7,0.05,0.1)*nBright*0.6;

    // === PLANETARY NEBULAE ===
    float pn1 = planetaryNebula(uv, vec2(0.25,0.70), 0.06, uTime);
    col += pn1*mix(vec3(0.0,0.6,1.0), vec3(1.0,0.4,0.0), pn1*0.3)*0.8*uProgress;

    float pn2 = planetaryNebula(uv, vec2(0.75,0.30), 0.04, uTime+5.0);
    col += pn2*mix(vec3(0.5,0.0,1.0), vec3(0.0,1.0,0.6), pn2*0.3)*0.6*uProgress;

    // === SUPERNOVA REMNANT ===
    float snr = supernovaRemnant(uv, vec2(0.60,0.65), 0.12, uTime);
    col += snr*vec3(0.9,0.4,0.1)*0.5*smoothstep(0.3,0.7,uProgress);

    // === GOD RAYS (32 rays) ===
    col += godRays(uv, uTime, uProgress, beatBoost);

    // === CENTRAL SINGULARITY ===
    col += singularity(uv, uTime, uProgress, beatBoost);

    // === VIGNETTE ===
    vec2 vig = (uv-0.5)*2.0;
    col *= 1.0-dot(vig,vig)*0.25;

    // === TONE MAP ===
    col = col/(col+0.8)*1.4;

    fragColor = vec4(col, 1.0);
}
