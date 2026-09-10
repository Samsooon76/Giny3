#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  vec3 c = vec3(0.0);
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  c += texture(uTex, vUV).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uTex, vUV + vec2(uTexel.x * float(i), 0.0)).rgb * w[i];
    c += texture(uTex, vUV - vec2(uTexel.x * float(i), 0.0)).rgb * w[i];
  }
  fragColor = vec4(c, 1.0);
}
