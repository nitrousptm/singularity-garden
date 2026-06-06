#version 460 core
// Color Enhancement — intensified saturation + vibrant grading

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uSaturation;    // 1.0 = normal, 1.5 = enhanced
uniform float uVibrance;      // boost underrepresented colors
uniform float uContrast;      // 1.0 = normal, 1.3 = enhanced
uniform float uLiftShadows;   // brighten shadows slightly

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec3 col = texture(uScene, vUV).rgb;

    // Shadow lift (brighten darks slightly)
    col = mix(col, col + uLiftShadows * 0.1, step(col, vec3(0.3)));

    // Contrast boost
    col = mix(vec3(0.5), col, uContrast);

    // Saturation + Vibrance
    vec3 hsv = rgb2hsv(col);
    hsv.y *= uSaturation;

    // Vibrance: boost muted colors
    hsv.y += (1.0 - hsv.z) * uVibrance * 0.3;

    col = hsv2rgb(hsv);

    fragColor = vec4(col, 1.0);
}
