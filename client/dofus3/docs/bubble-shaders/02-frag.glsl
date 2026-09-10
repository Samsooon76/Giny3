#version 300 es
precision highp float;

in vec2 vUV;
in vec4 vColor;
in vec4 vRect;
in vec2 vLocal;
in vec2 vWorld;
in vec2 vWaveUV;
in float vWindSample;
in float vParticleDissolve;
in vec4 vColorAdd;

uniform sampler2D _MainTex;
#ifdef _ENTITY_MULTI_TEXTURE
uniform sampler2D _EntityTex0;
uniform sampler2D _EntityTex1;
uniform sampler2D _EntityTex2;
uniform sampler2D _EntityTex3;
uniform sampler2D _EntityTex4;
uniform sampler2D _EntityTex5;
uniform sampler2D _EntityTex6;
uniform sampler2D _EntityTex7;
#endif
uniform float uColorBoost;        // DXBC live : constante 2 sur RGB
#ifdef _ENTITY_HUE_SHIFT
// Recolor par acteur (Monsters.HueShift/SaturationPct/BrightnessPct/GrayTintPct,
// archimonstres) : [teinte °, saturation ×, luminosité ×, teinte des gris] en
// HSV sur le texel échantillonné, posé par run (cf. buildDrawRuns).
uniform vec4 uRecolor;
${uf}
#endif
uniform float uModulateTextureAlpha; // 1=compensation PNG, 0=?alpha=dxbc
uniform float _AlphaClip;
uniform float uTime;
uniform vec2 uViewport;           // pixels framebuffer (devicePixelRatio inclus)

vec4 sampleMainTexture(vec2 uv) {
#ifdef _ENTITY_MULTI_TEXTURE
  float effectTexture = step(7.5, vParticleDissolve);
  int slot = int(vParticleDissolve - effectTexture * 8.0 + 0.5);
  if (slot == 0) return texture(_EntityTex0, uv);
  if (slot == 1) return texture(_EntityTex1, uv);
  if (slot == 2) return texture(_EntityTex2, uv);
  if (slot == 3) return texture(_EntityTex3, uv);
  if (slot == 4) return texture(_EntityTex4, uv);
  if (slot == 5) return texture(_EntityTex5, uv);
  if (slot == 6) return texture(_EntityTex6, uv);
  return texture(_EntityTex7, uv);
#else
  return texture(_MainTex, uv);
#endif
}

// ---- alpha split (profil 2.73 : texture alpha séparée) ----
uniform sampler2D _AlphaTex;
uniform float _AlphaSplitEnabled;

// ---- distorsion ----
uniform sampler2D _DistortionNoiseTex;
uniform sampler2D _DistortionMask;
uniform float uHasDistortionMask;
uniform vec4 _DistortionNoiseTex_ST; // xy=scale, zw=offset
uniform vec4 _DistortionVector;      // x=tile, y=force, zw=direction*vitesse
uniform vec4 _DistortionDirection;   // direction appliquée au bruit rouge scalaire
uniform float _IsDistortionLinkedToWind;
uniform float _GlobalWindPowerF;     // copie fragment du vent global

// ---- dissolve ----
uniform sampler2D _DissolveTex;
uniform sampler2D _DissolveMask;
uniform sampler2D _DissolveAnimationNoiseTex;
uniform float uHasDissolveMask;
uniform vec4 _DissolveTex_ST;
uniform vec4 _DissolveTexSpeed;
uniform float _DissolveAlphaClip;
uniform float _EnableDissolve; // 1=uniforme, 2=custom stream par particule
uniform float _DissolveAlphaClipFadeWidth;
uniform vec4 _DissolveBurnCol;
uniform float _DissolveBurnColPower;
uniform float _DissolveBurnWidth;
uniform float _IsDissolveBurnFaded;
uniform float _IsDissolveAnimated;
uniform float _DissolveFrequency;
uniform vec4 _DissolveAmplitude;    // xy = curveMin/curveMax
uniform float _ShouldSmoothDissolveAnimation;
uniform float _ShouldDissolveAnimationApplyNoise;
uniform float _DissolveAnimationNoiseStrength;
uniform float _DissolveAnimationNoiseSpeed;
uniform float _DissolveTimeOffset;
uniform float _DissolveTimeSyncOffset;
uniform int _DissolveCurveType;

// ---- emissive ----
uniform sampler2D _EmissiveTex;
uniform sampler2D _EmissiveDelaysTex;
uniform vec4 _EmissiveCol;
uniform float _EmissiveFactor;
uniform float _IsEmissiveAnimated;
uniform float _EmissiveVariationFrequency;
uniform float _EmissiveTimeOffset;
uniform float _EmissiveVariationMin;
uniform float _EmissiveVariationMax;
uniform float _EmissiveVariationClampMin;
uniform float _EmissiveVariationClampMax;
uniform float _AreEmissiveAreasDelayed;
uniform float uDbgEmissiveGain;

// ---- texture offset / flowmap ----
uniform vec4 _TextureOffsetDirection;
uniform float _TextureOffsetSpeed;
uniform sampler2D _FlowMapTex;
uniform float _FlowmapSpeed;
uniform float _FlowmapPower;

// ---- réfraction (échantillonne la scène opaque) ----
uniform sampler2D _SceneColorTex;
uniform sampler2D _RefractionNoiseTex;
uniform sampler2D _RefractionMaskTex;
uniform float uHasRefractionMask;
uniform vec4 _RefractionNoiseTex_ST;
uniform vec4 _RefractionVector;
uniform vec4 _RefractionColor;

// ---- waves globales (DofusMainShader live, variantes 379/1763) ----
uniform sampler2D _GlobalWaveMasksTex;
uniform sampler2D _WaveDynamicsTex;
uniform sampler2D _WaveDistoTex;
uniform sampler2D _WaveDissolveTex1;
uniform sampler2D _WaveDissolveTex2;
uniform sampler2D _WaveDissolveTex3;
uniform sampler2D _WaveDissolveTex4;
uniform sampler2D _WaveDissolveDynamicsTex;
uniform vec4 _WaveWaterCol1;
uniform vec4 _WaveWaterCol2;
uniform vec4 _WaveWaterCol3;
uniform vec4 _WaveWaterCol4;
uniform vec4 _WaveWaterCol1Dissolved;
uniform vec4 _WaveWaterCol2Dissolved;
uniform vec4 _WaveWaterCol3Dissolved;
uniform vec4 _WaveWaterCol4Dissolved;
uniform float _WaveFrequency;
uniform vec4 _WaveDirection;
uniform vec4 _WaveDistoTexTilingOffset;
uniform vec4 _WaveDistoTexSpeed;
uniform float _WaveDistoPower;
uniform vec4 _WaveDistoSpeedStopMinimums;
uniform vec4 _WaveDistoSpeedStopMaximums;
uniform vec4 _WaveDissolveTexTilingOffset1;
uniform vec4 _WaveDissolveTexTilingOffset2;
uniform vec4 _WaveDissolveTexTilingOffset3;
uniform vec4 _WaveDissolveTexTilingOffset4;
uniform vec4 _WaveDissolveTexSpeed1;
uniform vec4 _WaveDissolveTexSpeed2;
uniform vec4 _WaveDissolveTexSpeed3;
uniform vec4 _WaveDissolveTexSpeed4;
uniform float _WaveDissolvePower1;
uniform float _WaveDissolvePower2;
uniform float _WaveDissolvePower3;
uniform float _WaveDissolvePower4;
uniform vec4 _WaveDissolveShouldFade;
uniform vec4 _WaveDissolveFadeStartRatios;
uniform vec4 _WaveDissolveFadeDistanceRatios;
uniform float _WaveDissolveFadeDistance;

// ---- highlight / flash (défauts neutres, pilotables debug) ----
uniform float _EnableHighlight;
uniform vec4 _HighlightColor;
uniform int _FlashBlendMode;      // 0 none, 1 multiply, 2 screen, 3 invert
uniform vec4 _FlashColor;

// ---- debug ----
// 0 normal, 1 UV atlas, 2 UV locales, 3 alpha, 4 bruit distorsion,
// 5 vecteur distorsion, 6 emissive seule, 7 dissolve pattern, 8 overdraw,
// 9 échantillon vent, 10 monde
uniform int uDebugMode;

layout(location = 0) out vec4 fragColor;

float evalCurve(int type, float t, float freq, float timeOffset,
    float timeSyncOffset, float smoothed) {
  float phase = (t - timeSyncOffset) * freq + timeOffset;
  if (type == 0) {
    if (smoothed > 0.5) return sin(6.28318530718 * phase);
    float p = fract(phase);
    return p < 0.25 ? p * 4.0 : (p < 0.75 ? 2.0 - p * 4.0 : p * 4.0 - 4.0);
  }
  if (type == 1) {
    float p = fract(phase);
    return smoothed > 0.5 ? p * p * (3.0 - 2.0 * p) : p;
  }
  return clamp(phase, 0.0, 1.0);
}

// UV locales -> UV atlas, clampées au rect du sprite (évite le bleeding).
vec2 localToAtlas(vec2 local) {
  vec2 l = clamp(local, vec2(0.001), vec2(0.999));
  return vRect.xy + l * vRect.zw;
}

float signedFract(float value) {
  float valueSign = value >= -value ? 1.0 : -1.0;
  return fract(abs(value)) * valueSign;
}

#if defined(_ENTITY_FLASH_OVERLAY) || defined(_ENTITY_FLASH_HARDLIGHT)
vec3 flashOverlayBlend(vec3 backdrop, vec3 source, vec3 pivot) {
  vec3 low = 2.0 * backdrop * source;
  vec3 high = 1.0 - 2.0 * (1.0 - backdrop) * (1.0 - source);
  return mix(low, high, step(vec3(0.5), pivot));
}
#endif

float waveDissolveFade(float mask, float upper, float lower,
    float shouldFade, float startRatio, float distanceRatio) {
  float range = upper - lower;
  float start = lower + range * startRatio;
  float distance = max(range * distanceRatio, 0.001);
  return clamp(2.0 - shouldFade - abs(mask - start) / distance, 0.0, 1.0);
}

vec4 evaluateGlobalWave() {
  vec2 waveUV = vWaveUV;
  float progression = signedFract(
    (dot(waveUV, _WaveDirection.xy) + uTime) * _WaveFrequency);

  // Traduction du bloc de speed stops du PS DXBC live (blob 1763).
  vec4 stoppedProgress = vec4(progression)
    * step(_WaveDistoSpeedStopMinimums, vec4(progression));
  stoppedProgress *= step(stoppedProgress, _WaveDistoSpeedStopMaximums);
  vec4 stoppedRemainder = stoppedProgress
    - ceil(stoppedProgress) * _WaveDistoSpeedStopMinimums;
  vec4 distoBase = waveUV.xyxy * _WaveDistoTexTilingOffset.xyxy
    + _WaveDistoTexTilingOffset.zwzw
    + uTime * _WaveDistoTexSpeed.xyxy;
  vec4 distoUV12 = distoBase
    - stoppedRemainder.xxyy * _WaveDistoTexSpeed.xyxy / _WaveFrequency;
  vec4 distoUV34 = distoBase
    - stoppedRemainder.zzww * _WaveDistoTexSpeed.xyxy / _WaveFrequency;
  vec4 distoSamples = vec4(
    texture(_WaveDistoTex, distoUV12.xy).r,
    texture(_WaveDistoTex, distoUV12.zw).r,
    texture(_WaveDistoTex, distoUV34.xy).r,
    texture(_WaveDistoTex, distoUV34.zw).r
  );
  vec4 dynamics = texture(_WaveDynamicsTex, vec2(0.0, progression));
  vec4 thresholds = clamp(
    (distoSamples - 0.5) * (2.0 * _WaveDistoPower) + dynamics,
    0.0,
    1.0
  );

  float mask = texture(_GlobalWaveMasksTex, waveUV).r;
  vec4 dissolveDynamics = texture(
    _WaveDissolveDynamicsTex, vec2(0.0, progression));
  dissolveDynamics *= vec4(
    _WaveDissolvePower1,
    _WaveDissolvePower2,
    _WaveDissolvePower3,
    _WaveDissolvePower4
  );

  float firstFadeDistance = max(
    min(1.0 - thresholds.x, _WaveDissolveFadeDistance),
    0.01
  );
  float dissolveThreshold1 = dissolveDynamics.x
    * (1.0 - max(mask - thresholds.x, 0.01) / firstFadeDistance);
  float dissolveThreshold2 = dissolveDynamics.y * waveDissolveFade(
    mask, thresholds.x, thresholds.y,
    _WaveDissolveShouldFade.y,
    _WaveDissolveFadeStartRatios.y,
    _WaveDissolveFadeDistanceRatios.y
  );
  float dissolveThreshold3 = dissolveDynamics.z * waveDissolveFade(
    mask, thresholds.y, thresholds.z,
    _WaveDissolveShouldFade.z,
    _WaveDissolveFadeStartRatios.z,
    _WaveDissolveFadeDistanceRatios.z
  );
  float dissolveThreshold4 = dissolveDynamics.w * waveDissolveFade(
    mask, thresholds.z, thresholds.w,
    _WaveDissolveShouldFade.w,
    _WaveDissolveFadeStartRatios.w,
    _WaveDissolveFadeDistanceRatios.w
  );

  vec2 dissolveUV1 = waveUV * _WaveDissolveTexTilingOffset1.xy
    + _WaveDissolveTexTilingOffset1.zw
    + uTime * _WaveDissolveTexSpeed1.xy;
  vec2 dissolveUV2 = waveUV * _WaveDissolveTexTilingOffset2.xy
    + _WaveDissolveTexTilingOffset2.zw
    + uTime * _WaveDissolveTexSpeed2.xy;
  vec2 dissolveUV3 = waveUV * _WaveDissolveTexTilingOffset3.xy
    + _WaveDissolveTexTilingOffset3.zw
    + uTime * _WaveDissolveTexSpeed3.xy;
  vec2 dissolveUV4 = waveUV * _WaveDissolveTexTilingOffset4.xy
    + _WaveDissolveTexTilingOffset4.zw
    + uTime * _WaveDissolveTexSpeed4.xy;
  vec4 selectWaterColor = vec4(
    step(dissolveThreshold1, texture(_WaveDissolveTex1, dissolveUV1).r),
    step(dissolveThreshold2, texture(_WaveDissolveTex2, dissolveUV2).r),
    step(dissolveThreshold3, texture(_WaveDissolveTex3, dissolveUV3).r),
    step(dissolveThreshold4, texture(_WaveDissolveTex4, dissolveUV4).r)
  );

  float coverage = step(0.01, mask);
  vec4 aboveThreshold = coverage * step(thresholds, vec4(mask));
  float region1 = aboveThreshold.x;
  float region2 = aboveThreshold.y * (1.0 - aboveThreshold.x);
  float region3 = aboveThreshold.z
    * (1.0 - aboveThreshold.y)
    * (1.0 - aboveThreshold.x);
  float region4 = aboveThreshold.w
    * (1.0 - aboveThreshold.z)
    * (1.0 - aboveThreshold.y)
    * (1.0 - aboveThreshold.x);

  // PS DXBC 1763 : le comparatif dissolve sélectionne cb135..138 (couleurs
  // normales) ; son complément sélectionne cb139..142 (couleurs dissolved).
  vec4 color1 = mix(_WaveWaterCol1Dissolved, _WaveWaterCol1, selectWaterColor.x);
  vec4 color2 = mix(_WaveWaterCol2Dissolved, _WaveWaterCol2, selectWaterColor.y);
  vec4 color3 = mix(_WaveWaterCol3Dissolved, _WaveWaterCol3, selectWaterColor.z);
  vec4 color4 = mix(_WaveWaterCol4Dissolved, _WaveWaterCol4, selectWaterColor.w);
  return color1 * region1
    + color2 * region2
    + color3 * region3
    + color4 * region4;
}

void main() {
  vec2 localUV = vLocal;

  // ---- texture offset (Direction / FlowMap), en UV locales ----
#ifdef _TEXTUREOFFSETTYPE_DIRECTION
  localUV = fract(localUV + _TextureOffsetDirection.xy * (uTime * _TextureOffsetSpeed));
#endif
#ifdef _TEXTUREOFFSETTYPE_FLOWMAP
  {
    vec2 flow = texture(_FlowMapTex, localUV).rg * 2.0 - 1.0;
    localUV = fract(localUV + flow * _FlowmapPower * fract(uTime * _FlowmapSpeed));
  }
#endif

  // ---- distorsion : déplace les UV d'échantillonnage du sprite ----
  vec2 distDisp = vec2(0.0);
#ifdef _ENABLEDISTORTION_ON
  {
    // Traduction du PS DXBC live blob 1523 : repère, tile, temps, ST,
    // bruit rouge scalaire, masque, lien vent, puis direction.
#if defined(_DISTORTION_UVMODE_SCREENSPACE)
    vec2 nBase = (gl_FragCoord.xy / uViewport) * (uViewport.x / uViewport.y);
#elif defined(_DISTORTION_UVMODE_WORLDSPACE)
    // vWorld est en repère Web Y-down, tandis que le PS Unity reçoit la
    // position monde Y-up dans TEXCOORD2.zw. Sans cette conjugaison, le motif
    // world-space (notamment la fumée 401741) défile verticalement à l'envers.
    vec2 nBase = vec2(vWorld.x, -vWorld.y);
#else
    vec2 nBase = vLocal;
#endif
    float wind = mix(1.0, abs(_GlobalWindPowerF), step(0.5, _IsDistortionLinkedToWind));
    vec2 nUV = nBase * _DistortionVector.x;
    nUV += uTime * wind * _DistortionVector.zw;
    nUV = nUV * _DistortionNoiseTex_ST.xy + _DistortionNoiseTex_ST.zw;
    float n = texture(_DistortionNoiseTex, nUV).r * 2.0 - 1.0;
    float mask = uHasDistortionMask > 0.5 ? texture(_DistortionMask, vLocal).r : 1.0;
    distDisp = _DistortionDirection.xy * (n * _DistortionVector.y * wind * mask);
    localUV += distDisp;
  }
#endif

  // La variante Wave live synthétise directement sa couleur depuis le masque
  // global de la map. Elle ne lit ni _MainTex ni les anciens champs foam/noise.
#if defined(_AREWAVESENABLED) && defined(_ISWAVESSENSITIVE_ON)
  vec4 c = evaluateGlobalWave();
  c = clamp(c * vec4(vColor.rgb * uColorBoost, vColor.a), 0.0, 1.0);
#else
  vec4 mainSample = sampleMainTexture(localToAtlas(localUV));
#ifdef _ENTITY_HUE_SHIFT
  if (uRecolor != NEUTRAL_RECOLOR) mainSample.rgb = applyActorRecolor(mainSample.rgb, uRecolor);
#endif
  float sampledAlpha = _AlphaSplitEnabled > 0.5
    ? texture(_AlphaTex, localToAtlas(localUV)).r : mainSample.a;

  // PS DXBC : texture.a fait seulement le cutout. L'opacité vient de COLOR0.a.
  // Les PNG exportés exigent la modulation ; ?alpha=dxbc expose le natif A/B.
#ifdef _ENTITY_EFFECT_TEXTURE
  // La composition des filtres Flash D2 conserve les pixels jusqu'à 0,001.
  // Les RT RGBA16F préservent notamment les faibles alpha du bone 2864.
  if (sampledAlpha <= 0.001) discard;
#elif defined(_ENTITY_MULTI_TEXTURE)
  // Le second seuil est le float32 suivant 0,001 : une comparaison stricte
  // reproduit donc <= 0,001 sans branche divergente entre primitives.
  float entityCutout = mix(0.01, 0.0010000002, step(7.5, vParticleDissolve));
  if (sampledAlpha < entityCutout) discard;
#else
  if (sampledAlpha < 0.01) discard;
#endif
  float outputAlpha = vColor.a * mix(1.0, sampledAlpha, uModulateTextureAlpha);
  vec4 c = vec4(clamp(mainSample.rgb * vColor.rgb * uColorBoost, 0.0, 1.0),
                clamp(outputAlpha, 0.0, 1.0));
#endif

#ifdef _INTERACTIVE_HIGHLIGHT_COMPOSITE
  // Deux couches source-over réunies sans draw supplémentaire : source
  // Animator2D neutre (ColorTransform additif compris) puis son voile
  // (mul RGB 1,2, colorAdd 0,35, alpha pulsé). Le voile historique remplaçait
  // le colorAdd du sprite : il part donc bien de c avant vColorAdd.
  float interactivePulse = 0.13 + 0.05 * sin(uTime * 6.0);
  float veilAlpha = c.a * interactivePulse;
  float sourceAlpha = clamp(c.a * (1.0 + vColorAdd.a), 0.0, 1.0);
  vec3 sourceColor = clamp(c.rgb + vColorAdd.rgb, 0.0, 1.0);
  vec3 veilColor = clamp(
    clamp(mainSample.rgb * vColor.rgb * (1.2 * uColorBoost), 0.0, 1.0)
      + vec3(0.35),
    0.0,
    1.0
  );
  float compositeAlpha = veilAlpha + sourceAlpha * (1.0 - veilAlpha);
  vec3 compositePremultiplied = veilColor * veilAlpha
    + sourceColor * sourceAlpha * (1.0 - veilAlpha);
  c = vec4(compositePremultiplied / max(compositeAlpha, 0.000001), compositeAlpha);
#endif

#ifdef _ENTITY_COLOR_ADD
  // ColorTransform additif Flash des entités Jeff (hors référence PoC,
  // define posé uniquement par les matériaux d'entités, cf. entity-flash.ts).
  // aRect est libre pour ces items et transporte [ra,ga,ba,aa]. Parité
  // applyColorTransform du renderer D2 : add en espace straight avant la
  // prémultiplication ≡ (rgb+add)×a, alpha ×(1+aa).
  c.rgb = clamp(c.rgb + vColorAdd.rgb, 0.0, 1.0);
  c.a = clamp(c.a * (1.0 + vColorAdd.a), 0.0, 1.0);
#endif

#ifdef _INTERACTIVE_HIGHLIGHT_PULSE
  // Parité de l'ancien voile CPU : 0,08 + 0,10 × (0,5 + 0,5 sin(t × 6)).
  c.a *= 0.13 + 0.05 * sin(uTime * 6.0);
#endif

#ifdef _ENABLEALPHACLIPPING_ON
  if (c.a < _AlphaClip) discard;
#endif

  // ---- dissolve ----
  float dissolveNoise = 0.0;
  float dissolveClip = 0.0;
#ifdef _ENABLE_DISSOLVE
  {
    // DXBC live blob 1628 : le dissolve repart des UV déjà distordus et ne
    // force aucun Repeat (le sampler conserve le Clamp de noises/1).
    vec2 dUV = localUV * _DissolveTex_ST.xy + _DissolveTex_ST.zw + uTime * _DissolveTexSpeed.xy;
    dissolveNoise = texture(_DissolveTex, dUV).r;
    dissolveClip = _EnableDissolve > 1.5 ? vParticleDissolve : _DissolveAlphaClip;
    if (_IsDissolveAnimated > 0.5 && _DissolveCurveType != 2) {
      float t = evalCurve(_DissolveCurveType, uTime, _DissolveFrequency,
        _DissolveTimeOffset, _DissolveTimeSyncOffset,
        _ShouldSmoothDissolveAnimation);
      float w = _DissolveCurveType == 0 ? t * 0.5 + 0.5 : t;
      dissolveClip = mix(_DissolveAmplitude.x, _DissolveAmplitude.y, w);
    }
    // DXBC blob 1628 : le type Fixed (2) conserve _DissolveAlphaClip. Le
    // bruit d'animation est ensuite signé et ajouté à ce seuil.
    if (_IsDissolveAnimated > 0.5 && _ShouldDissolveAnimationApplyNoise > 0.5) {
      float noiseTime = uTime * _DissolveAnimationNoiseSpeed;
      float animationNoise = texture(_DissolveAnimationNoiseTex,
        vec2(noiseTime, noiseTime)).r * 2.0 - 1.0;
      dissolveClip += animationNoise * _DissolveAnimationNoiseStrength;
    }
    float mask = uHasDissolveMask > 0.5 ? texture(_DissolveMask, localUV).r : 1.0;
    // DXBC : center=1-clip*mask, puis smoothstep sur une bande centrée de
    // largeur fade. Une courbe custom 1→0 rend donc la particule visible puis
    // la dissout, et non l'inverse.
    float threshold = 1.0 - dissolveClip * mask;
    float fade = _DissolveAlphaClipFadeWidth;
    float d = dissolveNoise - (threshold - fade * 0.5);
    float keep;
    if (fade <= 0.0) {
      // Aucun epsilon artificiel : Fixed+fade=0 (84830) doit être un seuil
      // dur, pas une bande à 50 % révélant les blocs DXT5.
      keep = step(threshold, dissolveNoise);
    } else {
      float x = clamp(d / fade, 0.0, 1.0);
      keep = x * x * (3.0 - 2.0 * x);
    }
    // bande de burn autour du seuil
    if (_DissolveBurnWidth > 0.0 && d > 0.0 && d < _DissolveBurnWidth) {
      float bw = 1.0 - d / _DissolveBurnWidth;
      float bf = _IsDissolveBurnFaded > 0.5 ? bw : 1.0;
      c.rgb = mix(c.rgb, _DissolveBurnCol.rgb * max(_DissolveBurnColPower, 1.0), bf * _DissolveBurnCol.a);
    }
    c.a *= keep;
    if (c.a <= 0.001) discard;
  }
#endif

  // ---- highlight ----
  if (_EnableHighlight > 0.5) c.rgb = mix(c.rgb, _HighlightColor.rgb, _HighlightColor.a);

  // ---- flash (None/Multiply/Screen/Invert) ----
  if (_FlashBlendMode == 1) c.rgb *= _FlashColor.rgb;
  else if (_FlashBlendMode == 2) c.rgb = 1.0 - (1.0 - c.rgb) * (1.0 - _FlashColor.rgb * _FlashColor.a);
  else if (_FlashBlendMode == 3) c.rgb = mix(c.rgb, 1.0 - c.rgb, _FlashColor.a);

  // ---- réfraction : perturbe la scène derrière le sprite ----
#ifdef _ENABLEREFRACTION_ON
  {
#if defined(_REFRACTION_UVMODE_SCREENSPACE)
    vec2 rUV = gl_FragCoord.xy * _RefractionNoiseTex_ST.xy;
#elif defined(_REFRACTION_UVMODE_WORLDSPACE)
    vec2 rUV = vWorld * _RefractionNoiseTex_ST.xy;
#else
    vec2 rUV = vLocal * _RefractionNoiseTex_ST.xy;
#endif
    rUV += _RefractionNoiseTex_ST.zw + uTime * _RefractionVector.zw;
    vec2 rn = texture(_RefractionNoiseTex, fract(rUV)).rg * 2.0 - 1.0;
    float rMask = uHasRefractionMask > 0.5 ? texture(_RefractionMaskTex, vLocal).r : 1.0;
    vec2 screenUV = gl_FragCoord.xy / uViewport;
    vec3 refr = texture(_SceneColorTex, screenUV + rn * _RefractionVector.y * rMask).rgb;
    c.rgb = mix(c.rgb, refr * _RefractionColor.rgb, rMask * c.a);
  }
#endif

  // ---- emissive : formule exacte du pixel shader live, blob 1670 ----
  vec3 emissive = vec3(0.0);
#ifdef _ENABLE_EMISSIVE
  {
    vec4 em = texture(_EmissiveTex, vLocal);
    float anim = 1.0;
    if (_IsEmissiveAnimated > 0.5) {
      float phase = uTime * _EmissiveVariationFrequency + _EmissiveTimeOffset;
      if (_AreEmissiveAreasDelayed > 0.5)
        phase += texture(_EmissiveDelaysTex, vLocal).r;
      float t = sin(6.28318530718 * phase) * 0.5 + 0.5;
      anim = clamp(mix(_EmissiveVariationMin, _EmissiveVariationMax, t),
                   _EmissiveVariationClampMin, _EmissiveVariationClampMax);
    }
    float weight = em.r * (_EmissiveFactor * anim * uDbgEmissiveGain);
    vec4 beforeEmissive = c;
    c = mix(c, _EmissiveCol, weight);
    emissive = c.rgb - beforeEmissive.rgb;
  }
#endif

  // ---- sortie live : couleur prémultipliée après tous les lerp RGBA ----
  vec4 outc = vec4(c.rgb * c.a, c.a);

#if defined(_ENTITY_FLASH_OVERLAY) || defined(_ENTITY_FLASH_HARDLIGHT)
  // Parité du drawEffect D2 : le groupe Flash a été aplati dans sa RT, puis
  // se compose contre la scène capturée juste avant CE quad. Le mode 13
  // pivote sur le backdrop ; le mode 14 (hardlight) pivote sur la source.
  {
    vec4 source = outc;
    if (source.a <= 0.001) discard;
    vec4 backdrop = texture(_SceneColorTex, gl_FragCoord.xy / uViewport);
    vec3 sourceStraight = source.rgb / source.a;
    vec3 backdropStraight = backdrop.a > 0.0
      ? backdrop.rgb / backdrop.a
      : vec3(0.0);
#ifdef _ENTITY_FLASH_HARDLIGHT
    vec3 pivot = sourceStraight;
#else
    vec3 pivot = backdropStraight;
#endif
    vec3 blended = flashOverlayBlend(backdropStraight, sourceStraight, pivot);
    float compositeAlpha = source.a + backdrop.a * (1.0 - source.a);
    vec3 compositeStraight = mix(backdropStraight, blended, source.a);
    outc = vec4(compositeStraight * compositeAlpha, compositeAlpha);
  }
#endif

  // ---- modes debug ----
  if (uDebugMode == 1) outc = vec4(vUV, 0.0, 1.0);
  else if (uDebugMode == 2) outc = vec4(vLocal, 0.0, 1.0);
  else if (uDebugMode == 3) outc = vec4(vec3(c.a), 1.0);
  else if (uDebugMode == 4) outc = vec4(vec3(dissolveNoise), 1.0);
  else if (uDebugMode == 5) outc = vec4(distDisp * 20.0 + 0.5, 0.0, 1.0);
  else if (uDebugMode == 6) outc = vec4(emissive, 1.0);
  else if (uDebugMode == 8) outc = vec4(0.06, 0.06, 0.06, 0.06);
  else if (uDebugMode == 9) outc = vec4(vec3(vWindSample * 0.5 + 0.5) * c.a, c.a);
  else if (uDebugMode == 10) outc = vec4(fract(vWorld / 200.0), 0.0, 1.0) * c.a;

  fragColor = outc;
}
