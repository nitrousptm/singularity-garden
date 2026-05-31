// ============================================================
// SDF LIBRARY — Singularity Garden
// ============================================================

// --- Primitives ---

float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCone(vec3 p, float angle, float h) {
    vec2 q = vec2(length(p.xz), -p.y);
    float sinA = sin(angle), cosA = cos(angle);
    float d = max(dot(q, vec2(sinA, cosA)), -h - p.y);
    return d;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 ab = b-a, ap = p-a;
    float t = clamp(dot(ap,ab)/dot(ab,ab), 0.0, 1.0);
    return length(ap - t*ab) - r;
}

float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(length(p.xy - vec2(clamp(p.x, -k.z*h.x, k.z*h.x), h.x))*sign(p.y-h.x),
                  p.z - h.y);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    float m = p.x + p.y + p.z - s;
    vec3 q;
    if (3.0*p.x < m) q = p.xyz;
    else if (3.0*p.y < m) q = p.yzx;
    else if (3.0*p.z < m) q = p.zxy;
    else return m*0.57735027;
    float k = clamp(0.5*(q.z-q.y+s), 0.0, s);
    return length(vec3(q.x, q.y-s+k, q.z-k));
}

// --- Boolean operations ---
float opUnion(float a, float b)  { return min(a, b); }
float opSub(float a, float b)    { return max(a, -b); }
float opInter(float a, float b)  { return max(a, b); }

// Smooth union — IQ's polynomial smooth min
float smin(float a, float b, float k) {
    float h = max(k - abs(a-b), 0.0) / k;
    return min(a, b) - h*h*k*(1.0/4.0);
}

float smax(float a, float b, float k) {
    float h = max(k - abs(a-b), 0.0) / k;
    return max(a, b) + h*h*k*(1.0/4.0);
}

vec2 sminMat(vec2 a, vec2 b, float k) {
    float h = max(k - abs(a.x-b.x), 0.0) / k;
    float m = h*h*k*(1.0/4.0);
    float t = clamp(0.5 + 0.5*(b.x-a.x)/k, 0.0, 1.0);
    return vec2(min(a.x, b.x) - m, mix(a.y, b.y, t));
}

// --- Domain operations ---
vec3 opRepeat(vec3 p, vec3 c) { return mod(p + 0.5*c, c) - 0.5*c; }

vec3 opRepeatLim(vec3 p, float c, vec3 l) {
    return p - c*clamp(round(p/c), -l, l);
}

vec3 opTwist(vec3 p, float k) {
    float c = cos(k*p.y), s = sin(k*p.y);
    return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
}

vec3 opBend(vec3 p, float k) {
    float c = cos(k*p.x), s = sin(k*p.x);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

float opDisplace(float d, vec3 p, float scale) {
    return d + scale * sin(p.x*20.0)*sin(p.y*20.0)*sin(p.z*20.0);
}

// --- Hex grid (used in multiple scenes) ---
vec2 hexCoord(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h  = vec4(p - hC.xy*s, p - (hC.zw + 0.5)*s);
    return dot(h.xy,h.xy) < dot(h.zw,h.zw) ? h.xy : h.zw;
}

float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x) - 0.5;
}

float hexGrid(vec2 uv, float scale) {
    vec2 p = uv * scale;
    vec2 h = hexCoord(p);
    float d = hexDist(h);
    return smoothstep(0.02, 0.0, d + 0.48) * smoothstep(-0.48, -0.5, d);
}

// --- Fractal / procedural shapes ---

// Menger sponge (3 iterations)
float sdMenger(vec3 p, float s) {
    float d = sdBox(p, vec3(s));
    float scale = 1.0;
    for (int i = 0; i < 3; i++) {
        vec3 a = mod(p * scale, 2.0) - 1.0;
        scale *= 3.0;
        vec3 r = abs(1.0 - 3.0*abs(a));
        float c = (max(r.x, r.y) - 1.0) / scale;
        float e = (max(r.y, r.z) - 1.0) / scale;
        float f = (max(r.z, r.x) - 1.0) / scale;
        d = max(d, min(min(c, e), f));
    }
    return d;
}

// Mandelbox SDF (approx)
float sdMandelbox(vec3 p, float scale, int iters) {
    const float FOLDING_LIMIT = 1.0;
    const float MIN_RADIUS = 0.5;
    const float FIXED_RADIUS = 1.0;
    const float MR2 = MIN_RADIUS * MIN_RADIUS;
    const float FR2 = FIXED_RADIUS * FIXED_RADIUS;

    vec4 trap = vec4(abs(p), dot(p,p));
    vec4 z = vec4(p, 1.0);

    for (int i = 0; i < iters; i++) {
        // box fold
        z.xyz = clamp(z.xyz, -FOLDING_LIMIT, FOLDING_LIMIT) * 2.0 - z.xyz;
        // sphere fold
        float r2 = dot(z.xyz, z.xyz);
        z *= clamp(max(MR2/r2, MR2/FR2), 0.0, 1.0);
        z = z * scale + vec4(p, 0.0);
        trap = min(trap, vec4(abs(z.xyz), dot(z.xyz, z.xyz)));
    }
    return (length(z.xyz) - abs(scale-1.0)) / z.w - pow(abs(scale), float(1-iters));
}

// Fractal (IFS) tetrahedron
float sdFractalTetra(vec3 p, int iters) {
    const float scale = 2.0;
    float r;
    int i;
    for (i = 0; i < iters; i++) {
        if (p.x + p.y < 0.0) p.xy = -p.yx;
        if (p.x + p.z < 0.0) p.xz = -p.zx;
        if (p.y + p.z < 0.0) p.yz = -p.zy;
        p = scale * p - (scale-1.0);
        r = dot(p,p);
    }
    return (length(p) - 2.0) * pow(scale, -float(i));
}

// Rose curve extruded in 3D
float sdRose(vec3 p, float petals, float amp, float thick) {
    float theta = atan(p.z, p.x);
    float r = length(p.xz);
    float rose = amp * abs(cos(petals * theta));
    float d2d = abs(r - rose) - thick;
    return max(d2d, abs(p.y) - thick * 2.0);
}
