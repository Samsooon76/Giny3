#version 300 es
precision highp float;
uniform sampler2D uAtlasTex;
uniform vec4 uColorAdd;
uniform float uBinaryCoverage;
in vec2 vUv;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec4 tex = texture(uAtlasTex, vUv);
  if (tex.a < 0.01) discard;
  if (uBinaryCoverage > 0.5) {
    outColor = vec4(1.0);
    return;
  }
  vec3 rgb = clamp(tex.rgb * vColor.rgb * 2.0 + uColorAdd.rgb, 0.0, 1.0);
  float a = clamp(vColor.a * tex.a * (1.0 + uColorAdd.a), 0.0, 1.0);
  outColor = vec4(rgb * a, a);
}