#version 300 es
precision highp float;
uniform sampler2D uSourceTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = texture(uSourceTex, vUv);
}