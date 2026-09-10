#version 300 es
precision highp float;
uniform sampler2D uSourceTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 premult = texture(uSourceTex, vUv);
  outColor = premult.a > 0.0 ? vec4(premult.rgb / premult.a, premult.a) : vec4(0.0);
}