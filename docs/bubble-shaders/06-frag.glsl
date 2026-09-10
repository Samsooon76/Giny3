#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uLow;   // mip inférieure (déjà upsamplée)
uniform sampler2D uHigh;  // mip courante
uniform float uScatter;
out vec4 fragColor;
void main() {
  vec3 low = texture(uLow, vUV).rgb;
  vec3 high = texture(uHigh, vUV).rgb;
  fragColor = vec4(mix(high, low, uScatter), 1.0);
}
