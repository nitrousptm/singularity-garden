#version 460 core
// Bloom pre-filter: threshold + knee curve (Unreal-style)

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uHDRBuffer;
uniform float uThreshold;   // default 1.0
uniform float uKnee;        // soft knee, default 0.1

void main() {
    vec3 col = texture(uHDRBuffer, vUV).rgb;

    // Quadratic threshold with soft knee — enhanced sensitivity
    float brightness = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float rq = clamp(brightness - uThreshold * 0.7 + uKnee, 0.0, 2.0 * uKnee);
    rq = (rq * rq) / (4.0 * uKnee + 0.00001);
    float weight = max(rq, brightness - uThreshold * 0.7) / max(brightness, 0.00001);

    fragColor = vec4(col * weight, 1.0);
}
