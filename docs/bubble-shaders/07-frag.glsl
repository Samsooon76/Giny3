#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomIntensity;
uniform vec4 uBloomTint;
uniform float uBloomEnabled;
uniform float uChromaticAberration; // intensité 0..1
uniform float uFilmGrain;
// Étalonnage d'ambiance : teinte multiplicative, exposition, saturation.
// uGradeEnabled à 0 laisse l'image strictement inchangée.
uniform float uGradeEnabled;
// vec4 et non vec3 : le setter d'uniformes du renderer n'écrit que mat4,
// vec4, vec2, int et float ; un vec3 resterait à zéro et noircirait tout.
uniform vec4 uGradeTint;
uniform float uGradeExposure;
uniform float uGradeSaturation;
uniform float uTime;
uniform int uDebugView; // 0 final, 1 scène seule, 2 bloom seul
uniform float uOutputSrgbEncoding;
uniform int uTransitionMode;
uniform float uTransitionBlackOpacity;
uniform float uTransitionRevealProgress;
uniform float uTransitionMaskHoleRadius;
uniform float uTransitionWarpStrength;
uniform float uTransitionTime;
uniform vec2 uTransitionViewport;
uniform sampler2D uTransitionMask;
out vec4 fragColor;

float grain(vec2 uv, float t) {
  return fract(sin(dot(uv * 1000.0 + t, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec2 uv = vUV;
  if (uTransitionWarpStrength > 0.0001) {
    vec2 centered = uv - 0.5;
    float radius = length(centered);
    float wave = sin(radius * 28.0 - uTransitionTime * 9.0)
      * 0.018 * uTransitionWarpStrength * (1.0 - smoothstep(0.0, 0.75, radius));
    uv += radius > 0.00001 ? centered * (wave / radius) : vec2(0.0);
  }
  vec3 scene;
  if (uChromaticAberration > 0.001) {
    vec2 d = (uv - 0.5) * uChromaticAberration * 0.03;
    scene = vec3(texture(uScene, uv - d).r, texture(uScene, uv).g, texture(uScene, uv + d).b);
  } else {
    scene = texture(uScene, uv).rgb;
  }
  // 0.08 : normalisation de la chaîne de mips (URP applique l'intensité sur un
  // bloom déjà fortement atténué par ses 13-tap downsamples), [HYPOTHÈSE calibrée]
  vec3 bloom = texture(uBloom, uv).rgb * uBloomTint.rgb * (uBloomIntensity * 0.08) * uBloomEnabled;
  vec3 c = scene + bloom;
  if (uGradeEnabled > 0.5) {
    // Luma Rec. 709, comme la désaturation des filtres Flash du renderer D2.
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uGradeSaturation) * uGradeTint.rgb * uGradeExposure;
  }
  // Le grain est un artefact de capteur : il vient après l'étalonnage.
  if (uFilmGrain > 0.001) c += grain(uv, uTime) * uFilmGrain * 0.1;
  if (uDebugView == 1) c = scene;
  else if (uDebugView == 2) c = bloom;
  float transitionOpacity = 0.0;
  if (uTransitionMode == 1) {
    transitionOpacity = uTransitionBlackOpacity;
  } else if (uTransitionMode == 2) {
    if (uTransitionRevealProgress <= 0.00001) {
      transitionOpacity = uTransitionBlackOpacity;
    } else {
      vec2 pixelFromCenter = (vUV - 0.5) * uTransitionViewport;
      float halfDiagonal = length(uTransitionViewport * 0.5);
      float radius = length(pixelFromCenter) / max(halfDiagonal, 1.0);
      float feather = max(1.0, min(uTransitionViewport.x, uTransitionViewport.y) * 0.035)
        / max(halfDiagonal, 1.0);
      transitionOpacity = smoothstep(
        uTransitionRevealProgress,
        uTransitionRevealProgress + feather,
        radius
      ) * uTransitionBlackOpacity;
    }
  } else if (uTransitionMode == 3) {
    if (uTransitionRevealProgress <= 0.00001) {
      transitionOpacity = 1.0;
    } else {
      vec2 pixelFromCenter = (vUV - 0.5) * uTransitionViewport;
      float halfDiagonal = length(uTransitionViewport * 0.5);
      float side = halfDiagonal / max(uTransitionMaskHoleRadius, 0.00001)
        * uTransitionRevealProgress;
      vec2 maskUv = pixelFromCenter / max(side, 1.0) + 0.5;
      bvec2 below = lessThan(maskUv, vec2(0.0));
      bvec2 above = greaterThan(maskUv, vec2(1.0));
      transitionOpacity = any(below) || any(above)
        ? 1.0
        : texture(uTransitionMask, maskUv).r;
    }
  }
  if (uTransitionMode != 0) {
    c *= 1.0 - clamp(transitionOpacity, 0.0, 1.0);
  }
  fragColor = vec4(uOutputSrgbEncoding > 0.5 ? linearToSrgb(c) : c, 1.0);
}
