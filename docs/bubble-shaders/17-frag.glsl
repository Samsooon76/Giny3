#version 300 es
precision highp float;

in vec2 vUv;
in float vAlpha;
flat in int vTextureSlot;

uniform sampler2D uTextures[${ht}];
layout(location = 0) out vec4 outColor;

vec4 sampleActorTexture(int slot, vec2 uv) {
  if (slot == 0) return texture(uTextures[0], uv);
  if (slot == 1) return texture(uTextures[1], uv);
  if (slot == 2) return texture(uTextures[2], uv);
  if (slot == 3) return texture(uTextures[3], uv);
  if (slot == 4) return texture(uTextures[4], uv);
  if (slot == 5) return texture(uTextures[5], uv);
  if (slot == 6) return texture(uTextures[6], uv);
  return texture(uTextures[7], uv);
}

void main() {
  float alpha = sampleActorTexture(vTextureSlot, vUv).a * vAlpha;
  // Dofus 3 emploie des meshes presque transparents comme surfaces de souris.
  if (alpha <= ${Ry.toFixed(1)}) discard;
  outColor = vec4(1.0);
}
