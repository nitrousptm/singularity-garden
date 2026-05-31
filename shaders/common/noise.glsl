// ============================================================
// NOISE LIBRARY — Singularity Garden
// ============================================================

// --- Hash functions ---

uint hash1(uint x) {
    x ^= x >> 17; x *= 0xbf324c81u;
    x ^= x >> 11; x *= 0x9c7493adu;
    x ^= x >> 15;
    return x;
}

float hash11(float p) {
    uint n = floatBitsToUint(p);
    return float(hash1(n)) / 4294967296.0;
}

float hash12(vec2 p) {
    uvec2 q = uvec2(floatBitsToUint(p.x), floatBitsToUint(p.y));
    return float(hash1(q.x ^ hash1(q.y))) / 4294967296.0;
}

vec2 hash22(vec2 p) {
    uvec2 q = uvec2(floatBitsToUint(p.x), floatBitsToUint(p.y));
    uint a = hash1(q.x ^ hash1(q.y));
    uint b = hash1(q.y ^ hash1(q.x));
    return vec2(float(a), float(b)) / 4294967296.0;
}

float hash13(vec3 p) {
    uvec3 q = uvec3(floatBitsToUint(p.x), floatBitsToUint(p.y), floatBitsToUint(p.z));
    return float(hash1(hash1(q.x) ^ hash1(q.y) ^ hash1(q.z))) / 4294967296.0;
}

vec3 hash33(vec3 p) {
    uint a = hash1(floatBitsToUint(p.x) ^ hash1(floatBitsToUint(p.y)));
    uint b = hash1(floatBitsToUint(p.y) ^ hash1(floatBitsToUint(p.z)));
    uint c = hash1(floatBitsToUint(p.z) ^ hash1(floatBitsToUint(p.x)));
    return vec3(float(a),float(b),float(c)) / 4294967296.0;
}

// --- Value noise 2D ---
float vnoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f*f*(3.0 - 2.0*f);
    return mix(mix(hash12(i+vec2(0,0)), hash12(i+vec2(1,0)), u.x),
               mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}

// --- Value noise 3D ---
float vnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f*f*(3.0 - 2.0*f);
    return mix(mix(mix(hash13(i+vec3(0,0,0)), hash13(i+vec3(1,0,0)), u.x),
                   mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y),
               mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x),
                   mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y), u.z);
}

// --- Gradient noise 3D (Perlin-style) ---
vec3 gradVec(vec3 p) {
    vec3 h = hash33(floor(p)) * 2.0 - 1.0;
    return normalize(h);
}

float gnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    float n = 0.0;
    for (int z=0;z<2;z++) for (int y=0;y<2;y++) for (int x=0;x<2;x++) {
        vec3 off = vec3(x,y,z);
        vec3 g = gradVec(i+off);
        vec3 d = f - off;
        float w = mix(mix(1.0-u.x, u.x, float(x)),
                      mix(1.0-u.x, u.x, float(x)), float(x));
        // proper trilinear
        float wx = (x==0)?(1.0-u.x):u.x;
        float wy = (y==0)?(1.0-u.y):u.y;
        float wz = (z==0)?(1.0-u.z):u.z;
        n += wx*wy*wz * dot(g, d);
    }
    return n * 0.5 + 0.5;
}

// --- FBM (Fractional Brownian Motion) ---
float fbm2(vec2 p, int octaves, float lacunarity, float gain) {
    float v = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < octaves; i++) {
        v    += amp * vnoise2(p * freq);
        freq *= lacunarity;
        amp  *= gain;
    }
    return v;
}

float fbm3(vec3 p, int octaves, float lacunarity, float gain) {
    float v = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < octaves; i++) {
        v    += amp * vnoise3(p * freq);
        freq *= lacunarity;
        amp  *= gain;
    }
    return v;
}

// Turbulence (absolute value fbm)
float turbulence3(vec3 p, int oct) {
    float v = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < oct; i++) {
        v    += amp * abs(vnoise3(p * freq) * 2.0 - 1.0);
        freq *= 2.0; amp *= 0.5;
    }
    return v;
}

// Domain-warped FBM (Inigo Quilez technique)
float domainWarpFbm(vec3 p, int oct) {
    vec3 q = vec3(fbm3(p + vec3(0.0, 0.0, 0.0), oct, 2.0, 0.5),
                  fbm3(p + vec3(5.2, 1.3, 2.8), oct, 2.0, 0.5),
                  fbm3(p + vec3(1.7, 9.2, 4.1), oct, 2.0, 0.5));
    return fbm3(p + 4.0*q, oct, 2.0, 0.5);
}

// --- Voronoi / Worley noise ---
vec2 voronoi2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1e10;
    vec2  minCell = vec2(0.0);
    for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
            vec2 cell = vec2(x, y);
            vec2 rnd  = hash22(i + cell);
            vec2 diff = cell + rnd - f;
            float d   = dot(diff, diff);
            if (d < minDist) { minDist = d; minCell = i + cell + rnd; }
        }
    return vec2(sqrt(minDist), hash12(minCell));
}

// --- Simplex-like smooth noise (cheap) ---
float snoise3(vec3 p) {
    float n = vnoise3(p * 1.0);
    n += 0.5  * vnoise3(p * 2.0 + 1.7);
    n += 0.25 * vnoise3(p * 4.0 + 3.1);
    return n / 1.75;
}
