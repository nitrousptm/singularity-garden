#version 460 core
// Temporal Anti-Aliasing + accumulation for scene 4 (Time Fracture)

in  vec2 vUV;
out vec4 fragColor;

uniform sampler2D uCurrentFrame;
uniform sampler2D uPrevFrame;
uniform sampler2D uMotionVectors;  // optional, can be zero
uniform float uBlendFactor;        // 0.1 = smooth accumulation, 0.9 = fast response

void main() {
    vec3 current = texture(uCurrentFrame, vUV).rgb;

    // Neighbourhood clamp (variance clipping) to prevent ghosting
    vec3 c0 = textureOffset(uCurrentFrame, vUV, ivec2(-1, 0)).rgb;
    vec3 c1 = textureOffset(uCurrentFrame, vUV, ivec2( 1, 0)).rgb;
    vec3 c2 = textureOffset(uCurrentFrame, vUV, ivec2( 0,-1)).rgb;
    vec3 c3 = textureOffset(uCurrentFrame, vUV, ivec2( 0, 1)).rgb;

    vec3 minN = min(min(min(current, c0), min(c1, c2)), c3);
    vec3 maxN = max(max(max(current, c0), max(c1, c2)), c3);

    vec3 prev = texture(uPrevFrame, vUV).rgb;
    prev = clamp(prev, minN, maxN);

    // Blend
    vec3 result = mix(prev, current, uBlendFactor);
    fragColor = vec4(result, 1.0);
}
