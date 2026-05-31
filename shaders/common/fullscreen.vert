#version 460 core
// Oversized triangle — covers entire [-1,1]x[-1,1] NDC space
// Vertices: (-1,-1), (+3,-1), (-1,+3)

out vec2 vUV;
out vec2 vNDC;

void main() {
    float x = float(gl_VertexID & 1) * 4.0 - 1.0;
    float y = float((gl_VertexID >> 1) & 1) * 4.0 - 1.0;
    vUV  = vec2(x + 1.0, y + 1.0) * 0.5;
    vNDC = vec2(x, y);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
