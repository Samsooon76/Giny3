#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
in vec4 aColor;
// x=minX, y=minY, z=1/largeur, w=1/hauteur (px locaux entité, marge comprise)
uniform vec4 uBounds;
out vec2 vUv;
out vec4 vColor;
void main() {
  vUv = aUV;
  vColor = aColor;
  vec2 n = vec2((aPos.x - uBounds.x) * uBounds.z, (aPos.y - uBounds.y) * uBounds.w);
  // y local (bas de bloc) vers clip : le haut du bloc finit à v=1 dans la RT.
  gl_Position = vec4(n.x * 2.0 - 1.0, 1.0 - n.y * 2.0, 0.0, 1.0);
}