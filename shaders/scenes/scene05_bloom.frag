#version 460 core
// SCENE 5: GEOMETRY BLOOM — Mathematical Flowers, Fractal Temples, Ethereal Glow
// Duration: 1:45 - 2:30 (45 seconds)
// Extended: 9-fold petals with sub-veins, 6-level Sierpinski temple,
//           multiple flower species, volumetric bio-luminescence,
//           kaleidoscope sky, mandalic backgrounds, 5 light sources

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

#define PI  3.14159265359
#define TAU 6.28318530718

// =====================================================================
// MATH
// =====================================================================
float easeInOut(float t) { return t*t*(3.0-2.0*t); }
float beatPulse()        { return uBeatStrength*max(0.0,1.0-uBeatPhase*2.5); }

// =====================================================================
// NOISE (local)
// =====================================================================
float h11(float p) { return fract(sin(p*127.1)*43758.5453); }
float h12(vec2 p)  { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float h13v(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }

float vn3(vec3 p) {
    vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(
        mix(mix(h13v(i),h13v(i+vec3(1,0,0)),f.x),mix(h13v(i+vec3(0,1,0)),h13v(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(h13v(i+vec3(0,0,1)),h13v(i+vec3(1,0,1)),f.x),mix(h13v(i+vec3(0,1,1)),h13v(i+vec3(1,1,1)),f.x),f.y),f.z);
}

float fbm3(vec3 p, int oct) {
    float v=0.0,a=0.5;
    for(int i=0;i<oct;i++){v+=a*vn3(p);p=p*2.1+vec3(0.9,1.7,2.3);a*=0.5;}
    return v;
}

float dwfbm(vec3 p, int oct) {
    vec3 q = vec3(fbm3(p,3),fbm3(p+vec3(5.2,1.3,2.7),3),fbm3(p+vec3(1.8,9.2,3.1),3));
    return fbm3(p+q*0.8, oct);
}

float sdTorus(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz)-R, p.y);
    return length(q)-r;
}

// =====================================================================
// ROSE / RHODONEA FLOWER SDF
// =====================================================================
float sdRoseFlower(vec3 p, float t, float petals, float phase) {
    // Rotate
    float rotAng = t*0.15 + phase;
    float rc = cos(rotAng), rs = sin(rotAng);
    vec3 q = p;
    q.xz = mat2(rc,-rs,rs,rc)*q.xz;

    float theta = atan(q.z,q.x);
    float r     = length(q.xz);
    float n     = petals;

    // Primary rose curve
    float rose1 = 0.75*abs(cos(n*theta*0.5));
    // Secondary (sub-petals) — half-frequency
    float rose2 = 0.35*abs(cos(n*theta*0.5 + PI/n));

    float d1   = r - rose1;
    float d2   = r - rose2;
    float dYE  = abs(q.y) - 0.12 - sin(r*4.0)*0.04;

    float petal1 = length(vec2(max(d1,0.0),max(dYE,0.0))) + min(max(d1,dYE),0.0) - 0.04;
    float petal2 = length(vec2(max(d2,0.0),max(dYE*0.8,0.0))) + min(max(d2,dYE*0.8),0.0) - 0.02;

    // Petal surface veining
    float vein1 = sin(theta*n*3.0 + t*1.5)*0.015 * smoothstep(0.3,0.0,abs(d1));
    float vein2 = cos(r*12.0 + t*2.0)*0.010 * smoothstep(0.3,0.0,abs(d1));

    petal1 -= vein1 + vein2;
    return smin(petal1, petal2, 0.04);
}

// Stamen cluster
float sdStamen(vec3 p, float t, int count) {
    float d = 1e9;
    for(int i=0; i<count; i++) {
        float fi  = float(i);
        float ang = fi*TAU/float(count) + t*0.3;
        float r   = 0.08 + sin(fi*1.7+t)*0.02;
        vec3  sp  = p - vec3(cos(ang)*r, 0.0, sin(ang)*r);
        d = min(d, sdSphere(sp, 0.022));
        // Stamen stalk
        float stalk = sdCylinder(sp-vec3(0,0.02,0), 0.006, 0.04);
        d = min(d, stalk);
    }
    return d;
}

// Full flower assembly
float sdFlowerFull(vec3 p, float t, float petals, float phase) {
    float fp    = sdRoseFlower(p, t, petals, phase);
    // Center sphere with detail
    float ctr   = sdSphere(p, 0.18);
    ctr -= fbm3(p*6.0 + t*0.2, 3)*0.05;
    ctr -= fbm3(p*12.0 + t*0.4, 2)*0.02;
    // Stamens
    float stam  = sdStamen(p, t, int(petals)*2);
    // Calyx (sepals beneath petals)
    float calyx = sdRoseFlower(p*vec3(1,0.5,1), t+PI/petals, petals, phase)*0.8;
    float base  = sdOctahedron(p*vec3(1,2,1), 0.25);

    float res = smin(fp, ctr, 0.05);
    res = smin(res, stam, 0.03);
    res = smin(res, calyx, 0.06);
    return res;
}

// =====================================================================
// FRACTAL TEMPLE (6 levels)
// =====================================================================
float sdFractalTemple(vec3 p, float t) {
    // 6-level Sierpinski-Menger hybrid
    float scale = 2.0;
    vec3  q     = p*0.3;

    float d = sdOctahedron(q, 1.0);

    // Level 1
    q = abs(q*scale) - (scale-1.0)*0.5; q = q*0.85;
    d = smin(d, sdOctahedron(q, 0.4), 0.08);

    // Level 2 — add box holes
    q = abs(q*scale) - (scale-1.0)*0.5; q = q*0.85;
    d = smin(d, sdOctahedron(q, 0.18), 0.04);
    float box2 = sdBox(q*0.7, vec3(0.05,0.15,0.05));
    d = min(d, -box2*0.5);

    // Level 3
    q = abs(q*scale) - (scale-1.0)*0.5; q = q*0.85;
    d = smin(d, sdOctahedron(q, 0.08), 0.02);

    // Level 4
    q = abs(q*scale) - (scale-1.0)*0.5;
    d = smin(d, sdOctahedron(q, 0.032), 0.008);

    // Level 5
    q = abs(q*scale) - (scale-1.0)*0.5;
    d = smin(d, sdOctahedron(q, 0.014), 0.003);

    // Level 6 — micro-detail
    q = abs(q*scale) - (scale-1.0)*0.5;
    d = smin(d, sdOctahedron(q, 0.006), 0.001);

    // Animated torsion
    float torsion = fbm3(p*4.0 + vec3(t*0.1), 3)*0.025;
    d -= torsion;

    return d;
}

// =====================================================================
// LOTUS FLOWER (different species)
// =====================================================================
float sdLotus(vec3 p, float t) {
    float d = 1e9;
    int PETALS = 12;
    for(int i=0; i<PETALS; i++) {
        float ang = float(i)*TAU/float(PETALS);
        vec3 pp   = p;
        float c   = cos(ang), s = sin(ang);
        pp.xz = mat2(c,-s,s,c)*pp.xz;
        pp -= vec3(0.35,0.0,0.0);

        // Elongated petal shape
        float petal = sdBox(pp, vec3(0.12,0.025,0.07)) - 0.015;
        // Inward curve (concave)
        petal -= 0.03*sin(pp.x*8.0 + t*1.5);
        // Tip curl
        petal -= 0.02*max(0.0, pp.x-0.08)*sin(pp.y*15.0+t);

        d = smin(d, petal, 0.05);
    }
    // Inner petals (smaller ring)
    for(int i=0; i<8; i++) {
        float ang = float(i)*TAU/8.0 + PI/8.0;
        vec3 pp   = p;
        float c   = cos(ang), s = sin(ang);
        pp.xz = mat2(c,-s,s,c)*pp.xz;
        pp -= vec3(0.20,0.04,0.0);

        float petal = sdBox(pp, vec3(0.08,0.02,0.05)) - 0.01;
        petal -= 0.02*sin(pp.x*10.0 + t*2.0);
        d = smin(d, petal, 0.04);
    }
    // Receptacle
    float recept = sdSphere(p*vec3(1,0.6,1), 0.12);
    d = smin(d, recept, 0.06);
    return d;
}

// =====================================================================
// SCENE SDF (full composition)
// =====================================================================
vec2 sdScene5(vec3 p) {
    float grow = uProgress;
    float bp   = beatPulse();

    // Central flower (9-petals, main feature)
    float fScale   = smoothstep(0.0,0.4,grow);
    vec3  fp       = p/max(fScale,0.01);
    float flower1  = sdFlowerFull(fp, uTime, 9.0, 0.0)*fScale;

    // Ring of 6 secondary flowers (7-petals)
    float flowers = flower1;
    for(int i=0; i<6; i++) {
        float fi   = float(i);
        float ang  = fi*PI/3.0 + uTime*0.04;
        float r    = 2.3+sin(uTime*0.25+fi)*0.3;
        float ap   = smoothstep(0.08+fi*0.04, 0.28+fi*0.04, grow);
        vec3  fpos = p - vec3(cos(ang)*r, 0.0, sin(ang)*r);
        float fi2  = sdFlowerFull(fpos*0.55, uTime+fi, 7.0-float(i%3), fi*0.4)/0.55;
        flowers = smin(flowers, fi2*ap, 0.25);
    }

    // Outer ring of lotus flowers
    for(int i=0; i<4; i++) {
        float fi  = float(i);
        float ang = fi*PI/2.0 + uTime*0.02;
        float r   = 4.2+cos(fi*1.3)*0.4;
        float ap  = smoothstep(0.35, 0.65, grow);
        vec3  lp  = p - vec3(cos(ang)*r, -0.5, sin(ang)*r);
        float lo  = sdLotus(lp*0.4, uTime+fi)/0.4;
        flowers = smin(flowers, lo*ap, 0.35);
    }

    // Fractal temple (central background)
    float templeAp = smoothstep(0.4,0.8,grow);
    float temple   = sdFractalTemple(p, uTime)*templeAp;

    // Torus rings (concentric orbits)
    float rings = 1e9;
    for(int i=0; i<3; i++) {
        float fi   = float(i);
        float R    = 1.5+fi*0.8;
        float rt   = uTime*(0.1+fi*0.05);
        float c    = cos(rt), s = sin(rt);
        vec3  rp   = p;
        rp.xy = mat2(c,-s,s,c)*rp.xy;
        float ap   = smoothstep(0.2+fi*0.1, 0.5+fi*0.1, grow);
        rings = min(rings, sdTorus(rp, R, 0.04+fi*0.01)*ap);
    }

    // Ground with organic elevation
    float ground = p.y + 4.0
        + fbm3(p*0.4 + uTime*0.04, 5)*0.7
        + fbm3(p*0.9 + uTime*0.08, 3)*0.3;

    vec2 res = sminMat(vec2(flowers, 1.0), vec2(temple, 2.0), 0.5);
    res = sminMat(res, vec2(rings, 3.0), 0.3);
    res = sminMat(res, vec2(ground, 4.0), 0.5);
    return res;
}

float calcAO5(vec3 pos, vec3 nor) {
    float occ=0.0, sca=1.0;
    for(int i=0;i<6;i++){
        float h=0.01+0.14*float(i)/5.0;
        float d=sdScene5(pos+h*nor).x;
        occ+=(h-d)*sca; sca*=0.92;
    }
    return clamp(1.0-3.0*occ,0.0,1.0);
}

vec3 calcNormal5(vec3 p) {
    const float e=0.002;
    return normalize(vec3(
        sdScene5(p+vec3(e,0,0)).x-sdScene5(p-vec3(e,0,0)).x,
        sdScene5(p+vec3(0,e,0)).x-sdScene5(p-vec3(0,e,0)).x,
        sdScene5(p+vec3(0,0,e)).x-sdScene5(p-vec3(0,0,e)).x));
}

// =====================================================================
// VOLUMETRIC BIO-LUMINESCENCE (32 steps, dithered)
// =====================================================================
float ign(vec2 c) { return fract(52.9829189*fract(dot(c,vec2(0.06711056,0.00583715)))); }

vec3 volumetricScatter(vec3 ro, vec3 rd, float tHit) {
    vec3  acc   = vec3(0.0);
    float trans = 1.0;
    float tMax  = min(tHit, 10.0);
    float step  = tMax/32.0;
    float dith  = ign(gl_FragCoord.xy)*step;
    float bp    = beatPulse();

    for(int i=0; i<32; i++) {
        float tt = dith+float(i)*step;
        vec3  p  = ro+rd*tt;
        float d  = sdScene5(p).x;

        // Near-surface bio-luminescence
        float nearSurf = exp(-max(d,0.0)*2.5);
        // Domain-warped volumetric density
        float dens  = dwfbm(p*0.4+uTime*0.04, 4)*nearSurf*0.3;
        dens += fbm3(p*0.8+uTime*0.06, 3)*0.15;
        if(dens < 0.01) { tt+=step; continue; }

        float sigmaT = dens*2.8;

        // Color gradient: position-dependent
        float cp    = (p.y+4.0)/8.0 + uProgress*0.25 + uTime*0.03;
        vec3  c1    = vec3(0.2,1.0,0.8);  // cyan
        vec3  c2    = vec3(1.0,0.2,0.8);  // magenta
        vec3  c3    = vec3(1.0,0.8,0.2);  // gold
        vec3  c4    = vec3(0.5,0.1,1.0);  // violet
        float cpf   = fract(cp);
        int   cpi   = int(cp)%4;
        vec3  volC  = (cpi==0)?mix(c1,c2,cpf):(cpi==1)?mix(c2,c3,cpf):(cpi==2)?mix(c3,c4,cpf):mix(c4,c1,cpf);

        // Beat surge
        volC *= 1.0+bp*1.5;

        acc   += volC*dens*trans*step*0.18;
        trans *= exp(-sigmaT*step);
        if(trans < 0.004) break;
    }
    return acc;
}

// =====================================================================
// KALEIDOSCOPE SKY
// =====================================================================
vec3 kaleidoscopeSky(vec3 rd, float t, float prog) {
    float az  = atan(rd.z,rd.x);
    float el  = atan(rd.y, length(rd.xz));
    float h   = clamp(rd.y*0.5+0.5, 0.0, 1.0);

    // Base sky gradient
    vec3 zenith = mix(vec3(0.010,0.004,0.028), vec3(0.038,0.0,0.110), prog);
    vec3 horiz  = mix(vec3(0.018,0.022,0.10),  vec3(0.048,0.012,0.20), prog);
    vec3 sky    = mix(horiz, zenith, pow(h,0.35));

    // Aurora curtains
    float aGate = smoothstep(0.15,0.45,rd.y);
    if(aGate > 0.001) {
        float tA = t*0.05;
        for(int ci=0; ci<3; ci++) {
            float coff = float(ci)*2.094;
            float az2  = az+coff;
            float wave = vn3(vec3(az2*1.6, rd.y*3.0, tA+float(ci)*5.7))*0.5
                       + vn3(vec3(az2*3.2, rd.y*6.0, tA*1.8+float(ci)*3.1))*0.25;
            float sway = sin(tA*0.35+float(ci)*2.1)*0.75;
            float curt = smoothstep(0.32,0.0,abs(az2-sway))*wave;
            vec3 aCols[3] = vec3[3](
                mix(vec3(0.30,0.0,0.90),vec3(0.90,0.12,0.70),wave),
                mix(vec3(0.05,0.45,0.90),vec3(0.50,0.0,0.80),wave),
                mix(vec3(0.0,0.8,0.5),vec3(0.9,0.5,0.0),wave)
            );
            sky += aCols[ci]*curt*aGate*0.25*prog;
        }
    }

    // Kaleidoscope mirror (6-fold)
    float kMix = smoothstep(0.38,0.65,prog);
    if(kMix > 0.001) {
        const float SECTOR = PI/3.0;
        float azK = mod(az+PI, 2.0*SECTOR);
        if(azK > SECTOR) azK = 2.0*SECTOR-azK;
        azK -= SECTOR*0.5;
        float cEl = cos(el);
        vec3 rdK  = normalize(vec3(cEl*cos(azK), sin(el), cEl*sin(azK)));
        // Recursively get sky at mirrored direction
        float hK  = clamp(rdK.y*0.5+0.5,0.0,1.0);
        vec3 skyK = mix(horiz,zenith,pow(hK,0.35));
        sky = mix(sky, skyK, kMix*0.7);
    }

    return sky;
}

// =====================================================================
// MAIN
// =====================================================================
void main() {
    vec2 ndc = (vUV*2.0-1.0)*vec2(uResolution.x/uResolution.y,1.0);
    float bp = beatPulse();

    // Camera: spiraling inward, tilts with progress
    float camAng  = uTime*0.08 + uProgress*0.55 + bp*0.03;
    float camH    = mix(-0.5, 3.5, uProgress);
    float camDist = mix(9.0, 4.5, easeInOut(uProgress));
    // Beat nudge
    camDist -= bp*0.4;
    camH    += bp*0.2;

    vec3 ro = vec3(sin(camAng)*camDist, camH, cos(camAng)*camDist);
    vec3 ta = vec3(0.0, mix(-0.3,1.0,uProgress), 0.0);

    vec3 fwd   = normalize(ta-ro);
    vec3 right = normalize(cross(fwd, vec3(0,1,0)));
    vec3 up    = cross(right, fwd);
    float fov  = radians(mix(68.0,58.0,uProgress));
    vec3  rd   = normalize(fwd + ndc.x*right*tan(fov*0.5) + ndc.y*up*tan(fov*0.5));

    // === SKY (kaleidoscoped) ===
    vec3 col = kaleidoscopeSky(rd, uTime, uProgress);

    // Stars (distant background)
    float starH  = h12(floor(rd.xy*300.0));
    col += pow(max(starH-0.97,0.0),2.0)*22.0*vec3(0.8,0.9,1.0)*uProgress;

    // === RAYMARCHING ===
    float t = 0.08, matID = 0.0;
    for(int i=0; i<128; i++) {
        vec2 hit = sdScene5(ro+rd*t);
        if(hit.x < 0.0008) { matID = hit.y; break; }
        if(t > 45.0) break;
        t += hit.x*0.80;
    }

    if(matID > 0.0 && t < 45.0) {
        vec3 pos = ro+rd*t;
        vec3 N   = calcNormal5(pos);
        vec3 V   = -rd;

        // === 5 LIGHT SOURCES ===
        vec3 L1 = normalize(vec3(sin(uTime*0.5)*3.0, 4.0, cos(uTime*0.5)*3.0));
        vec3 L2 = normalize(vec3(-2.0, 2.0, 1.0));
        vec3 L3 = normalize(vec3(0.0, -1.0, 0.0));
        vec3 L4 = normalize(vec3(sin(uTime*0.3+2.0)*2.0, 1.0, cos(uTime*0.3+2.0)*2.0));
        vec3 L5 = normalize(vec3(0.5, 3.5, -1.5));

        vec3 lc1 = vec3(0.3,1.0,0.8)*3.0*(1.0+bp*0.8);
        vec3 lc2 = vec3(1.0,0.3,0.8)*2.0*(1.0+bp*0.5);
        vec3 lc3 = vec3(0.8,0.5,0.0)*1.5;
        vec3 lc4 = vec3(0.5,0.1,1.0)*2.5*(1.0+bp*1.2);
        vec3 lc5 = vec3(0.9,0.8,0.3)*1.2;

        float ao = calcAO5(pos, N);

        if(matID < 1.5) {
            // === FLOWER: iridescent bioluminescent ===
            float colorAng  = atan(pos.z,pos.x)+uTime*0.12;
            float colorR    = length(pos.xz);
            vec3  petalHue  = vec3(
                sin(colorAng*3.0+colorR*5.0)*0.5+0.5,
                cos(colorAng*2.0+uTime*0.3)*0.5+0.5,
                sin(colorAng*5.0+1.0+bp*2.0)*0.5+0.5);

            float fresnel   = pow(1.0-max(dot(N,V),0.0), 3.5);
            vec3  albedo    = mix(vec3(0.04), petalHue*0.85, 0.75);
            float m = 0.3, r = 0.18;

            vec3 sh = cookTorrance(N,V,L1,albedo,m,r)*lc1
                    + cookTorrance(N,V,L2,albedo,m,r)*lc2
                    + cookTorrance(N,V,L4,albedo,m,r)*lc4;
            vec3 env = envLighting(N,V,albedo,m,r, vec3(0.1,0.05,0.2), vec3(0.05,0.02,0.1));

            // Bio-luminescent emission
            float bioGlow = 0.6+fresnel*2.5+bp*1.5;
            vec3  emit    = petalHue*bioGlow*1.8;
            emit += vec3(1.0,1.0,0.8)*pow(fresnel,5.0)*3.0;

            // Iridescence (angle-dependent color shift)
            float irid     = dot(N,V)*0.5+0.5;
            vec3  iridCol  = vec3(sin(irid*6.28+uTime),
                                  cos(irid*6.28+uTime+2.0),
                                  sin(irid*6.28+uTime+4.0))*0.5+0.5;
            emit += iridCol*0.6*fresnel;

            col = sh + env*ao*0.4 + emit;
        }
        else if(matID < 2.5) {
            // === TEMPLE: sacred stone with gold veins + crystal ===
            float vein1 = dwfbm(pos*2.5, 5);
            float vein2 = fbm3(pos*5.5 + uTime*0.05, 4);
            float facet = pow(max(vein1-0.45,0.0),2.5);

            vec3 stone  = mix(vec3(0.18,0.14,0.10), vec3(0.35,0.28,0.18), vein1);
            vec3 gold   = vec3(1.0,0.75,0.12);
            vec3 crystal= mix(vec3(0.0,0.5,1.0), vec3(0.8,0.0,1.0), vein2);
            vec3 albedo = mix(stone, gold, step(0.68,vein1));
            albedo      = mix(albedo, crystal, facet*0.5);

            float m = mix(0.1,0.9,step(0.68,vein1));
            float r = mix(0.65,0.15,step(0.68,vein1));
            m = mix(m, 0.7, facet*0.5);

            vec3 sh  = cookTorrance(N,V,L1,albedo,m,r)*lc1
                     + cookTorrance(N,V,L2,albedo,m,r)*lc2
                     + cookTorrance(N,V,L5,albedo,m,r)*lc5;
            vec3 env = envLighting(N,V,albedo,m,r, vec3(0.12,0.06,0.25), vec3(0.06,0.02,0.12));

            // Crystal glow emission — enhanced
            vec3 crystEmit = crystal*facet*4.2*(1.0+bp*2.0);
            vec3 goldEmit  = gold*step(0.68,vein1)*0.8*ao;

            col = sh + env*ao*0.5 + crystEmit + goldEmit;
        }
        else if(matID < 3.5) {
            // === ORBIT RING: glowing toroid ===
            float ringPulse = sin(atan(pos.z,pos.x)*8.0 + uTime*3.0)*0.5+0.5;
            vec3  ringCol   = mix(vec3(0.0,0.8,1.0), vec3(1.0,0.2,0.8), ringPulse);
            float fresnel   = pow(1.0-max(dot(N,V),0.0), 3.0);
            col = ringCol*(3.2+fresnel*6.0+bp*3.0);
        }
        else {
            // === GROUND: bio-luminescent moss ===
            float gp1 = fbm3(pos*0.35, 5);
            float gp2 = dwfbm(pos*0.8+uTime*0.02, 3);
            vec3  albedo = mix(vec3(0.06,0.04,0.10), vec3(0.14,0.08,0.18), gp1);

            // Glow grid — enhanced intensity
            vec2 grid = fract(pos.xz*0.5);
            float gLine = smoothstep(0.06,0.0,min(grid.x,grid.y))+smoothstep(0.06,0.0,min(1.0-grid.x,1.0-grid.y));
            vec3 gridCol = mix(vec3(0.1,0.5,0.8), vec3(0.8,0.2,1.0), gp2)*gLine*0.7;

            vec3 sh = cookTorrance(N,V,L1,albedo,0.0,0.85)*lc1;
            col = sh + gridCol;
        }

        col *= mix(0.4,1.0,ao);

        // Fog
        float fog = 1.0-exp(-t*0.025);
        col = mix(col, kaleidoscopeSky(rd,uTime,uProgress)*0.5, fog);
    }

    // === VOLUMETRIC BIO-LUMINESCENCE ===
    col += volumetricScatter(ro, rd, t);

    // === BEAT PULSE ===
    float bFlash = pow(1.0-uBeatPhase,10.0)*uBeatStrength;
    col += vec3(0.4,0.8,0.4)*bFlash*0.6;

    // === BAR FLASH ===
    float barFlash = pow(max(0.0,1.0-uBeatPhase*6.0),3.0)*0.35
                   * smoothstep(0.2,0.5,uProgress)*uBeatStrength;
    col += mix(vec3(0.2,0.5,1.0),vec3(1.0,0.3,0.8),uBeatPhase)*barFlash;

    // === TONE MAP ===
    col = col/(col+0.8)*1.35;

    fragColor = vec4(col, 1.0);
}
