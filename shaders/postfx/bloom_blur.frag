#version 460 core
// Dual Kawase blur (two-pass: downsample / upsample)
// Pass 0: downsample — samples from larger MIP
// Pass 1: upsample — bilinear 4-tap tent filter

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uInput;
uniform vec2 uTexelSize;     // 1.0 / textureSize
uniform int  uPass;          // 0=downsample, 1=upsample
uniform float uRadius;       // filter radius in texels (default 0.5)

vec4 downsample(vec2 uv) {
    // 13-tap box filter (Jimenez)
    vec4 a = texture(uInput, uv + uTexelSize * vec2(-2, -2) * uRadius);
    vec4 b = texture(uInput, uv + uTexelSize * vec2( 0, -2) * uRadius);
    vec4 c = texture(uInput, uv + uTexelSize * vec2( 2, -2) * uRadius);
    vec4 d = texture(uInput, uv + uTexelSize * vec2(-1, -1) * uRadius);
    vec4 e = texture(uInput, uv + uTexelSize * vec2( 1, -1) * uRadius);
    vec4 f = texture(uInput, uv + uTexelSize * vec2(-2,  0) * uRadius);
    vec4 g = texture(uInput, uv);
    vec4 h = texture(uInput, uv + uTexelSize * vec2( 2,  0) * uRadius);
    vec4 i = texture(uInput, uv + uTexelSize * vec2(-1,  1) * uRadius);
    vec4 j = texture(uInput, uv + uTexelSize * vec2( 1,  1) * uRadius);
    vec4 k = texture(uInput, uv + uTexelSize * vec2(-2,  2) * uRadius);
    vec4 l = texture(uInput, uv + uTexelSize * vec2( 0,  2) * uRadius);
    vec4 m = texture(uInput, uv + uTexelSize * vec2( 2,  2) * uRadius);

    return (d+e+i+j) * 0.6 / 4.0 +
           (a+b+g+f) * 0.15 / 4.0 +
           (b+c+h+g) * 0.15 / 4.0 +
           (f+g+l+k) * 0.15 / 4.0 +
           (g+h+m+l) * 0.15 / 4.0;
}

vec4 upsample(vec2 uv) {
    // 9-tap bilinear tent filter
    vec4 a = texture(uInput, uv + uTexelSize * vec2(-1, -1) * uRadius);
    vec4 b = texture(uInput, uv + uTexelSize * vec2( 0, -1) * uRadius);
    vec4 c = texture(uInput, uv + uTexelSize * vec2( 1, -1) * uRadius);
    vec4 d = texture(uInput, uv + uTexelSize * vec2(-1,  0) * uRadius);
    vec4 e = texture(uInput, uv);
    vec4 f = texture(uInput, uv + uTexelSize * vec2( 1,  0) * uRadius);
    vec4 g = texture(uInput, uv + uTexelSize * vec2(-1,  1) * uRadius);
    vec4 h = texture(uInput, uv + uTexelSize * vec2( 0,  1) * uRadius);
    vec4 ii= texture(uInput, uv + uTexelSize * vec2( 1,  1) * uRadius);

    return (a+c+g+ii) * (1.0/16.0) +
           (b+d+f+h)  * (2.0/16.0) +
           e           * (4.0/16.0);
}

void main() {
    if (uPass == 0)
        fragColor = downsample(vUV);
    else
        fragColor = upsample(vUV);
}
