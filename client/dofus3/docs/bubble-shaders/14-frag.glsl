#version 300 es
precision highp float;
uniform sampler2D uBlurredTex;
uniform sampler2D uOriginalTex;
uniform vec4 uShadowColor;
// x=strength, y=inner, z=knockout, w=compositeSource
uniform vec4 uShadowParams;
uniform vec2 uOffset;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 original = texture(uOriginalTex, vUv);
  float blurredAlpha = texture(uBlurredTex, vUv + uOffset).a;
  float strength = uShadowParams.x;
  bool inner = uShadowParams.y > 0.5;
  bool knockout = uShadowParams.z > 0.5;
  bool compositeSource = uShadowParams.w > 0.5;
  float effectAlpha = inner
    ? clamp((1.0 - blurredAlpha) * strength, 0.0, 1.0)
    : clamp(blurredAlpha * strength, 0.0, 1.0);
  float shadowAlpha = uShadowColor.a * effectAlpha;
  vec4 shadow = vec4(uShadowColor.rgb * shadowAlpha, shadowAlpha);
  if (inner) {
    vec4 maskedShadow = shadow * original.a;
    if (knockout || !compositeSource) {
      outColor = maskedShadow;
      return;
    }
    outColor = maskedShadow + original * (1.0 - shadow.a);
    return;
  }
  if (knockout) {
    outColor = shadow * (1.0 - original.a);
    return;
  }
  if (!compositeSource) {
    outColor = shadow;
    return;
  }
  outColor = original + shadow * (1.0 - original.a);
}