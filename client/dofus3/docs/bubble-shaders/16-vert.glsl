#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
layout(location = 2) in float aAlpha;
layout(location = 3) in float aTextureSlot;

uniform vec2 uWorldPoint;

out vec2 vUv;
out float vAlpha;
flat out int vTextureSlot;

void main() {
  vec2 clip = (aPosition - uWorldPoint) / ${Ne/2}.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUv;
  vAlpha = aAlpha;
  vTextureSlot = int(aTextureSlot + 0.5);
}
