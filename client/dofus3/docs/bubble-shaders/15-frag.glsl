#version 300 es
precision highp float;
uniform sampler2D uSourceTex;
uniform sampler2D uMaskTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 source = texture(uSourceTex, vUv);
  float maskAlpha = texture(uMaskTex, vUv).a;
  if (maskAlpha <= 0.0) discard;
  float coverage = maskAlpha <= 0.2 ? maskAlpha * 5.0 : 1.0;
  outColor = source * coverage;
}