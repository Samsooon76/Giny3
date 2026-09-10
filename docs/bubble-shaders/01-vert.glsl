#version 300 es
precision highp float;

#ifdef _INTERACTIVE_OUTLINE_QUEUED
const vec2 INTERACTIVE_OUTLINE_OFFSETS[${Un.length}] = vec2[${Un.length}](${Sm});
#elif defined(_INTERACTIVE_OUTLINE_SHOW)
const vec2 INTERACTIVE_OUTLINE_OFFSETS[${xr.length}] = vec2[${xr.length}](${Im});
#endif

#ifdef _ENTITY_GPU_DESCRIPTORS
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec4 aColor;

uniform sampler2D uActorDescriptorTex;
uniform int uActorDescriptorTextureWidth;
uniform int uActorDescriptorBase;

vec4 fetchActorDescriptorTexel(int descriptorId, int texelOffset) {
  int linearTexel = descriptorId * 4 + texelOffset;
  ivec2 coordinate = ivec2(
    linearTexel % uActorDescriptorTextureWidth,
    linearTexel / uActorDescriptorTextureWidth
  );
  return texelFetch(uActorDescriptorTex, coordinate, 0);
}
#else
in vec2 aPos;      // position monde web (statique, batchée)
in vec2 aUV;       // UV atlas
in vec4 aColor;    // couleur élément (convention x2 appliquée en fragment)
in vec4 aRect;     // rect atlas du sprite (x,y,w,h), origine bas-gauche GL
in vec2 aLocal;    // UV locales sprite 0..1
#endif

uniform mat4 uViewProj;
uniform float uTime;
uniform vec4 _Color;
#if defined(_AREWAVESENABLED) && defined(_ISWAVESSENSITIVE_ON)
uniform mat4 _GlobalWaveMasksTexCamMatrix;
#endif

// Animation couleur : le DXBC live l'applique au COLOR0 du vertex, avant la
// multiplication par la texture, et interpole les quatre composantes.
uniform vec4 _ColorAnimationFinalColor;
uniform float _ColorAnimationFrequency;
uniform float _ColorAnimationTimeOffset;
uniform float _ColorAnimationTimeSyncOffset;
uniform float _IsColorAnimationFrequencyLinkedToWind;
uniform float _ShouldSmoothColorAnimation;
#ifdef HAS_COLOR_ANIMATION_NOISE
uniform float _ShouldColorAnimationApplyNoise;
uniform sampler2D _ColorAnimationNoiseTex;
uniform vec4 _ColorAnimationNoiseTex_ST;
uniform vec4 _ColorAnimationNoiseTex_TexelSize;
uniform float _ColorAnimationNoiseStrength;
uniform vec4 _ColorAnimationNoiseTimeSpeed;
uniform vec4 _ColorAnimationNoiseTimeOffset;
uniform float _ColorAnimationNoiseTimeSyncOffset;
uniform vec4 _IsColorAnimationNoiseLinkedToWind; // x=vitesse, y=force
#endif

// ---- vent global (contrat exact UpdateGlobalWind) ----
uniform float _GlobalWindPower;
uniform sampler2D _WindModelTex;
uniform sampler2D _WindNoiseTex;
uniform sampler2D _WindSwingNoiseTex;
uniform vec4 _GlobalWindNoiseTilingDirection;      // xy=tiling, zw=direction*mult*freq
uniform float _MainWindAmplitudeMultiplier;
uniform float _MainWindAmplitudeCurvePower;
uniform float _MainWindFrequencyCurvePower;
uniform vec4 _GlobalWindSwingNoiseTilingDirection;
uniform float _GlobalWindSwingAmplitudeCurvePower;
uniform float _GlobalWindSwingFrequencyCurvePower;
uniform float _GlobalWindSwingAmplitudeMultiplier;
uniform vec4 _GlobalWindNoiseSpeed;
uniform float _GlobalMinimumWindSwingAmplitude;

// ---- vent local (packing validé contre le dump runtime) ----
uniform int _WindHierarchyDepth;
uniform vec4 _WSBendCenters[${xt}];
uniform vec4 _WSBendStarts[${xt}];
uniform vec4 _BendAxes[${xt}];
uniform vec4 _Flexibilities;
uniform vec4 _ShouldSwingArray;
uniform vec4 _WindSwingNoiseSpeedCoefs;
uniform vec4 _WindSwingNoiseAmplitudes;

// ---- rotation ----
uniform vec4 _RotationCenter;
uniform float _RotationFrequency;
uniform float _RotationAmplitude;   // radians, signe déjà conjugué web
uniform float _RotationOffset;
uniform float _RotationTimeOffset;
uniform float _RotationTimeSyncOffset;
uniform vec4 _IsRotationAnimLinkedToWind; // x=freq, y=amplitude
uniform float _ShouldSmoothRotation;
#ifdef HAS_ROTATION_NOISE
uniform float _ShouldRotationApplyNoise;
uniform sampler2D _RotationNoiseTex;
uniform vec4 _RotationNoiseTex_ST;
uniform vec4 _RotationNoiseTex_TexelSize;
uniform float _RotationNoiseStrength;
uniform vec4 _RotationNoiseTimeSpeed;
uniform vec4 _RotationNoiseTimeOffset;
uniform float _RotationNoiseTimeSyncOffset;
uniform vec4 _IsRotationNoiseLinkedToWind; // x=vitesse, y=force
#endif

// ---- translation ----
uniform vec4 _TranslationDirection;
uniform float _TranslationFrequency;
uniform float _TranslationAmplitude;   // plage crête-à-crête, unités du vertex
uniform float _TranslationOffset;
uniform float _TranslationTimeOffset;
uniform float _TranslationTimeSyncOffset;
uniform vec4 _IsTranslationAnimLinkedToWind;
uniform float _ShouldSmoothTranslation;
#ifdef HAS_TRANSLATION_NOISE
uniform float _ShouldTranslationApplyNoise;
uniform sampler2D _TranslationNoiseTex;
uniform vec4 _TranslationNoiseTex_ST;
uniform vec4 _TranslationNoiseTex_TexelSize;
uniform vec4 _TranslationNoiseStrength;
uniform vec4 _TranslationNoiseTimeSpeed;
uniform vec4 _TranslationNoiseTimeOffset;
uniform float _TranslationNoiseTimeSyncOffset;
uniform vec4 _IsTranslationNoiseLinkedToWind; // x=vitesse, y=force
#endif

// ---- scale ----
uniform vec4 _ScaleAxes;
uniform vec4 _ScalePivot;
uniform float _ScaleFrequency;
uniform float _ScaleAmplitude;
uniform float _ScaleOffset;
uniform float _ScaleTimeOffset;
uniform float _ScaleTimeSyncOffset;
uniform vec4 _IsScaleAnimLinkedToWind;
uniform float _ShouldSmoothScale;
#ifdef HAS_SCALE_NOISE
uniform float _ShouldScaleApplyNoise;
uniform sampler2D _ScaleNoiseTex;
uniform vec4 _ScaleNoiseTex_TexelSize;
uniform vec4 _ScaleNoiseStrength;
uniform vec4 _ScaleNoiseOffset;
uniform vec4 _ScaleNoiseTimeSpeed;
uniform vec4 _ScaleNoiseTimeOffset;
uniform float _ScaleNoiseTimeSyncOffset;
uniform vec4 _IsScaleNoiseLinkedToWind; // x=vitesse, y=force
#endif

// gains de calibration debug (1 = valeur nominale)
uniform float uDbgWindGain;
uniform float uDbgSwingGain;

out vec2 vUV;
out vec4 vColor;
out vec4 vRect;
out vec2 vLocal;
out vec2 vWorld;
out vec2 vWaveUV;
out float vWindSample; // pour le mode debug vent
#ifndef _ENTITY_GPU_DESCRIPTORS
layout(location = 5) in float aParticleDissolve;
#endif
out float vParticleDissolve;
#ifndef _ENTITY_GPU_DESCRIPTORS
layout(location = 6) in vec4 aColorAdd;
#endif
out vec4 vColorAdd;

// Courbes : mêmes formules que curves.js (contrat de test).
float evalCurve(int type, float t, float freq, float timeOffset, float offset, float smoothed) {
  float phase = (t + timeOffset) * freq + offset;
  if (type == 0) { // PingPong -> [-1,1]
    // fract avant sin : précision constante quand t devient grand (float32)
    if (smoothed > 0.5) return sin(6.28318530718 * fract(phase));
    float p = fract(phase);
    return p < 0.25 ? p * 4.0 : (p < 0.75 ? 2.0 - p * 4.0 : p * 4.0 - 4.0);
  }
  if (type == 1) { // Loop -> [0,1)
    float p = fract(phase);
    return smoothed > 0.5 ? p * p * (3.0 - 2.0 * p) : p;
  }
  return clamp(phase, 0.0, 1.0); // Fixed
}

float linkedWindFactor(float linked) {
  return mix(1.0, abs(_GlobalWindPower), step(0.5, linked));
}

float managedPhase(float t, float frequency, float timeOffset,
    float timeSyncOffset, float linkedToWind) {
  return (t - timeSyncOffset) * frequency * linkedWindFactor(linkedToWind)
    + timeOffset;
}

vec2 managedNoisePhase(float t, vec2 speed, vec2 timeOffset,
    float timeSyncOffset, float speedLinkedToWind) {
  return (t - timeSyncOffset) * speed * linkedWindFactor(speedLinkedToWind)
    + timeOffset;
}

// Traduction littérale du chemin sans noise du VS DXBC live. Particularité
// essentielle : _ColorAnimationTimeOffset est une phase ajoutée APRES
// (time-timeSync)*frequency. Les calculs de signed fract reproduisent les
// instructions ge/movc/abs/frc du bytecode, y compris pour un temps négatif.
float evalColorAnimationWeight(int type, float t, float freq, float timeOffset,
  float timeSyncOffset, float smoothed, float linkedToWind) {
  float effectiveFrequency = freq * (linkedToWind > 0.5 ? abs(_GlobalWindPower) : 1.0);
  float phase = (t - timeSyncOffset) * effectiveFrequency + timeOffset;
  float phaseSign = phase >= -phase ? 1.0 : -1.0;
  float signedPhase = fract(abs(phase)) * phaseSign;
  float weight;
  if (type == 0) {
    if (smoothed > 0.5) {
      weight = sin(6.28318530718 * signedPhase) * 0.5 + 0.5;
    } else {
      float shifted = signedPhase + 0.25;
      float shiftedSign = shifted >= -shifted ? 1.0 : -1.0;
      float p = fract(abs(shifted)) * shiftedSign;
      weight = p > 0.5 ? (1.0 - p) * 2.0 : p * 2.0;
    }
  } else if (type == 1) {
    weight = smoothed > 0.5
      ? sin(3.14159265359 * (signedPhase - 0.5)) * 0.5 + 0.5
      : signedPhase;
  } else {
    weight = 1.0;
  }
  return clamp(weight, 0.0, 1.0);
}

// Traduction de la variante _ROTATIONTYPE_PINGPONG du VS DXBC live :
// timeOffset est une phase (après time*frequency) et amplitude est la plage
// crête-à-crête, d'où le facteur 0.5.
float evalRotationAngle(int type, float t, float frequency, float timeOffset,
  float timeSyncOffset, float amplitude, float offset, float smoothed,
  float frequencyLinkedToWind) {
  float phase = managedPhase(t, frequency, timeOffset, timeSyncOffset,
    frequencyLinkedToWind);
  // _ROTATIONTYPE_FIXED, VS DXBC blob 514 : mov r0.x, cb2[71].w.
  if (type == 2) return offset;
  if (type == 0) {
    float p = fract(phase);
    float curve = smoothed > 0.5
      ? sin(6.28318530718 * p)
      : (p < 0.25 ? p * 4.0 : (p < 0.75 ? 2.0 - p * 4.0 : p * 4.0 - 4.0));
    return offset + amplitude * 0.5 * curve;
  }
  // Variante Loop : courbe animée non signée.
  return offset + amplitude * evalCurve(type, phase, 1.0,
    0.0, 0.0, smoothed);
}

vec2 rot2(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// Vent principal : formule désassemblée de la variante DXBC 2.73
// _ISWINDENABLED + _WINDSENSITIVETYPE_NOISE_DYNAMIC_PARAMETERS :
//   freq = pow(abs(power), frequencyCurvePower)
//   uv = center*tiling.xy + time*freq*direction.zw
//   amp = noise.r * amplitudeMultiplier * pow(abs(power), amplitudeCurvePower)
// Le bruit principal reste en [0,1] : il n'est PAS recentré en [-1,1].
uniform int uWindFieldMode;
float mainWindAmplitude(vec2 worldPos, float t) {
  float p = abs(_GlobalWindPower);
  float freq = pow(max(p, 1e-8), _MainWindFrequencyCurvePower);
  // Les bend centers ont été convertis en monde Web Y-down pour la géométrie,
  // mais le DXBC construit les UV depuis le monde Unity Y-up.
  vec2 unityWorldPos = vec2(worldPos.x, -worldPos.y);
  vec2 uv = unityWorldPos * _GlobalWindNoiseTilingDirection.xy
          + t * freq * _GlobalWindNoiseTilingDirection.zw;
  // Le DXBC ne contient pas de frac explicite : l'adressage est porté par le
  // sampler Unity. Les captures live réfutent cependant Clamp pour ce sample
  // (gfx 802170 varie d'environ 3 px en 12 s, alors que Clamp est constant).
  // Notre texture WebGL est Repeat ; fract reproduit cet adressage sans
  // dépendre de l'état résiduel du sampler.
  float n = textureLod(_WindNoiseTex, fract(uv), 0.0).r;
  return n * _MainWindAmplitudeMultiplier
    * pow(max(p, 1e-8), _MainWindAmplitudeCurvePower);
}

// Variante NoiseDynamic exacte : _WindModelTex(abs(power), flexibility).r
// pilote la vitesse du bruit swing et .g son amplitude. Le bytecode multiplie
// ensuite par le multiplicateur global, shouldSwing et ceil(abs(power)).
float dynamicSwing(vec2 worldPos, float flexibility, float shouldSwing, float t) {
  float p = abs(_GlobalWindPower);
  vec2 model = textureLod(_WindModelTex, vec2(p, flexibility), 0.0).rg;
  vec2 unityWorldPos = vec2(worldPos.x, -worldPos.y);
  vec2 uv = unityWorldPos * _GlobalWindSwingNoiseTilingDirection.xy
          + t * model.x * _GlobalWindSwingNoiseTilingDirection.zw;
  float n = textureLod(_WindSwingNoiseTex, fract(uv), 0.0).r;
  return (n * 2.0 - 1.0) * model.y
    * _GlobalWindSwingAmplitudeMultiplier * shouldSwing * ceil(p);
}

// Ancien modèle conservé uniquement pour l'A/B debug.
float legacyWindSigned(vec2 worldPos, float t) {
  vec2 unityWorldPos = vec2(worldPos.x, -worldPos.y);
  vec2 uv = unityWorldPos * _GlobalWindNoiseTilingDirection.xy
          + t * _GlobalWindNoiseTilingDirection.zw;
  return textureLod(_WindNoiseTex, fract(uv), 0.0).r * 2.0 - 1.0;
}

// Contrat DXBC live (MapWind.Unity6.Live.Reverse.md) : la progression le long
// de l'axe part du bend START, la rotation pivote autour du bend CENTER.
// L'ancien port avait les deux inversés, invisible quand start == center,
// faux pour les 41 éléments de la map 212601859 où ils divergent.
vec2 bendPoint(vec2 point, vec2 start, vec2 center, vec2 axis, float angleAmplitude) {
  float len2 = max(dot(axis, axis), 1e-5);
  float progression = max(dot(point - start, axis) / len2, 0.0);
  return center + rot2(point - center, progression * angleAmplitude);
}

// Contrat DXBC 2.73 des animations liées au vent : fréquence/amplitude sont
// multipliées par abs(power), valeur CONSTANTE. Aucun bruit n'entre dans la
// phase : l'ancien modèle créait une accélération/décélération artificielle.
float windLinkedValue(float value, float linked) {
  return value * mix(1.0, abs(_GlobalWindPower), step(0.5, linked));
}

// VS DXBC 2.73 blob 531 : _ScaleOffset est une valeur d'échelle statique,
// pas un décalage de phase. _ScaleAmplitude est crête-à-crête.
float evalScaleDelta(int type, float t, float freq, float timeOffset,
    float timeSyncOffset, float amplitude, float offset, float smoothed,
    float frequencyLinkedToWind) {
  float phase = managedPhase(t, freq, timeOffset, timeSyncOffset,
    frequencyLinkedToWind);
  // _SCALETYPE_FIXED, VS DXBC blob 514 : mov r0.yz, cb2[63].wwww.
  if (type == 2) return offset;
  if (type == 0) {
    float p = fract(phase);
    float curve = smoothed > 0.5
      ? sin(6.28318530718 * p)
      : (p < 0.25 ? p * 4.0 : (p < 0.75 ? 2.0 - p * 4.0 : p * 4.0 - 4.0));
    return offset + amplitude * 0.5 * curve;
  }
  return offset + amplitude * 0.5
    * evalCurve(type, phase, 1.0, 0.0, 0.0, smoothed);
}

void main() {
#ifdef _ENTITY_GPU_DESCRIPTORS
  int descriptorId = uActorDescriptorBase + gl_DrawID;
  // ABI compact-v3 : abcd | tx,ty,texture,rect.x | rect.yzw,add.r | add.gba,uvLocal.
  vec4 descriptor0 = fetchActorDescriptorTexel(descriptorId, 0);
  vec4 descriptor1 = fetchActorDescriptorTexel(descriptorId, 1);
  vec4 descriptor2 = fetchActorDescriptorTexel(descriptorId, 2);
  vec4 descriptor3 = fetchActorDescriptorTexel(descriptorId, 3);
  vec2 pos = vec2(
    descriptor0.x * aPos.x + descriptor0.z * aPos.y + descriptor1.x,
    descriptor0.y * aPos.x + descriptor0.w * aPos.y + descriptor1.y
  );
  float actorTextureCode = descriptor1.z;
  vec4 actorRect = vec4(descriptor1.w, descriptor2.xyz);
  vec4 actorColorAdd = vec4(descriptor2.w, descriptor3.xyz);
  bool actorUvIsLocal = descriptor3.w > 0.5;
#else
  vec2 pos = aPos;
#endif
  vWindSample = 0.0;

#ifdef _ENABLESCALE_ON
  {
    float amp = windLinkedValue(_ScaleAmplitude, _IsScaleAnimLinkedToWind.y);
    float delta = evalScaleDelta(SCALE_CURVE, uTime, _ScaleFrequency,
      _ScaleTimeOffset, _ScaleTimeSyncOffset, amp, _ScaleOffset,
      _ShouldSmoothScale, _IsScaleAnimLinkedToWind.x);
    vec2 s = vec2(1.0) + _ScaleAxes.xy * delta;
#ifdef HAS_SCALE_NOISE
    if (_ShouldScaleApplyNoise > 0.5) {
      vec2 noisePhase = managedNoisePhase(
        uTime,
        _ScaleNoiseTimeSpeed.xy,
        _ScaleNoiseTimeOffset.xy,
        _ScaleNoiseTimeSyncOffset,
        _IsScaleNoiseLinkedToWind.x
      );
      vec2 noiseUVX = vec2(
        noisePhase.x,
        noisePhase.x * _ScaleNoiseTex_TexelSize.y
      );
      vec2 noiseUVY = vec2(
        noisePhase.y,
        noisePhase.y * _ScaleNoiseTex_TexelSize.y + 0.5
      );
      vec2 signedNoise = vec2(
        textureLod(_ScaleNoiseTex, noiseUVX, 0.0).r,
        textureLod(_ScaleNoiseTex, noiseUVY, 0.0).r
      ) * 2.0 - 1.0;
      float noiseStrengthWind = linkedWindFactor(
        _IsScaleNoiseLinkedToWind.y
      );
      s += signedNoise * _ScaleNoiseStrength.xy * noiseStrengthWind
        + _ScaleNoiseOffset.xy;
    }
#endif
    pos = _ScalePivot.xy + (pos - _ScalePivot.xy) * s;
  }
#endif

#ifdef _ENABLETRANSLATION_ON
  {
    float amplitude = windLinkedValue(_TranslationAmplitude, _IsTranslationAnimLinkedToWind.y);
    // VS DXBC live blob 80 : phase=time*frequency+timeOffset, puis
    // delta=offset+amplitude*0.5*curve. Le vertex reçoit directement ce delta,
    // sans conversion PPU ni facteur 100.
    float delta = evalScaleDelta(TRANSLATION_CURVE, uTime,
      _TranslationFrequency, _TranslationTimeOffset,
      _TranslationTimeSyncOffset, amplitude, _TranslationOffset,
      _ShouldSmoothTranslation, _IsTranslationAnimLinkedToWind.x);
    pos += _TranslationDirection.xy * delta;
#ifdef HAS_TRANSLATION_NOISE
    if (_ShouldTranslationApplyNoise > 0.5) {
      vec2 noisePhase = managedNoisePhase(
        uTime,
        _TranslationNoiseTimeSpeed.xy,
        _TranslationNoiseTimeOffset.xy,
        _TranslationNoiseTimeSyncOffset,
        _IsTranslationNoiseLinkedToWind.x
      );
      vec2 noiseUVX = vec2(
        noisePhase.x + _TranslationNoiseTex_ST.z,
        noisePhase.x * _TranslationNoiseTex_TexelSize.y
          + _TranslationNoiseTex_ST.w
      );
      vec2 noiseUVY = vec2(
        noisePhase.y + _TranslationNoiseTex_ST.z,
        noisePhase.y * _TranslationNoiseTex_TexelSize.y
          + _TranslationNoiseTex_ST.w + 0.5
      );
      vec2 signedNoise = vec2(
        textureLod(_TranslationNoiseTex, noiseUVX, 0.0).r,
        textureLod(_TranslationNoiseTex, noiseUVY, 0.0).r
      ) * 2.0 - 1.0;
      float noiseStrengthWind = linkedWindFactor(
        _IsTranslationNoiseLinkedToWind.y
      );
      pos += signedNoise * _TranslationNoiseStrength.xy
        * noiseStrengthWind;
    }
#endif
  }
#endif

#if defined(_ISWINDSENSITIVE_ON) && defined(_ISWINDENABLED)
  {
    // Copie locale nécessaire : le shader Unity propage la flexion d'un parent
    // aux center/start/axis de tous ses enfants avant de plier le sommet.
    vec2 centers[${xt}];
    vec2 starts[${xt}];
    vec2 axes[${xt}];
    for (int i = 0; i < ${xt}; i++) {
      centers[i] = _WSBendCenters[i].xy;
      starts[i] = _WSBendStarts[i].xy;
      axes[i] = _BendAxes[i].xy;
    }
    // Le shader live ne déroule que TROIS niveaux : le cbuffer réserve quatre
    // slots mais le DXBC ne lit que 0..2 (MapWind.Unity6.Live.Reverse.md).
    // Plier un 4e niveau ajoutait un étage de flexion que le client officiel
    // n'applique jamais (cimes d'arbres qui « décollent » sur 212601859).
    int windDepth = min(_WindHierarchyDepth, 3);
    // Le DXBC échantillonne le vent principal une fois, ancré sur le bend
    // START racine, et réutilise cette amplitude pour toute la hiérarchie.
    float rootMainAmp = mainWindAmplitude(starts[0], uTime);
    for (int i = 0; i < ${xt}; i++) {
      if (i >= windDepth) break;
      vec2 center = centers[i];
      vec2 start = starts[i];
      vec2 axis = axes[i];
      float len2 = max(dot(axis, axis), 1e-5);
      float flex = _Flexibilities[i];
      float angleAmplitude;
      if (uWindFieldMode == 0) {
        float axisY = axis.y * inversesqrt(len2);
        // Les UV spatiaux du bruit de swing sont ancrés sur le bend START du
        // niveau (déjà déformé par les parents), pas sur le center.
        float swing = dynamicSwing(start, flex, _ShouldSwingArray[i], uTime);
        // Conjugaison Unity Y-up -> web Y-down : normAxisUnity.y=-axisY et
        // angleWeb=-angleUnity, d'où -main*axisY + swing.
        angleAmplitude =
          -rootMainAmp * flex * sign(_GlobalWindPower) * axisY * uDbgWindGain
          + swing * uDbgSwingGain;
        if (i == windDepth - 1) vWindSample = rootMainAmp;
      } else {
        float w = legacyWindSigned(center, uTime);
        angleAmplitude = -w * _GlobalWindPower
          * _MainWindAmplitudeMultiplier * flex * uDbgWindGain;
        if (i == windDepth - 1) vWindSample = w;
      }

      // Exactement ce que déroule le DXBC : le parent transforme le repère de
      // chaque descendant, et l'axe enfant est reconstruit depuis son bend
      // START (Bend(start + axis) - Bend(start)), pas depuis son center.
      for (int j = 0; j < ${xt}; j++) {
        if (j <= i || j >= windDepth) continue;
        vec2 bentStart = bendPoint(starts[j], start, center, axis, angleAmplitude);
        vec2 bentEnd = bendPoint(starts[j] + axes[j], start, center, axis, angleAmplitude);
        centers[j] = bendPoint(centers[j], start, center, axis, angleAmplitude);
        starts[j] = bentStart;
        axes[j] = bentEnd - bentStart;
      }
      pos = bendPoint(pos, start, center, axis, angleAmplitude);
    }
  }
#endif

// Dans la variante DXBC _ISWINDSENSITIVE_ON + _ENABLEROTATION_ON, la
// rotation monde vient APRÈS toute la hiérarchie de flexion du vent.
#ifdef _ENABLEROTATION_ON
  {
    float amp = windLinkedValue(_RotationAmplitude, _IsRotationAnimLinkedToWind.y);
    float angle = evalRotationAngle(ROTATION_CURVE, uTime,
      _RotationFrequency, _RotationTimeOffset, _RotationTimeSyncOffset,
      amp, _RotationOffset, _ShouldSmoothRotation,
      _IsRotationAnimLinkedToWind.x);
#ifdef HAS_ROTATION_NOISE
    if (_ShouldRotationApplyNoise > 0.5) {
      vec2 noisePhase = managedNoisePhase(
        uTime,
        _RotationNoiseTimeSpeed.xy,
        _RotationNoiseTimeOffset.xy,
        _RotationNoiseTimeSyncOffset,
        _IsRotationNoiseLinkedToWind.x
      );
      vec2 noiseUV = vec2(
        noisePhase.x + _RotationNoiseTex_ST.z,
        noisePhase.x * _RotationNoiseTex_TexelSize.y
          + _RotationNoiseTex_ST.w
      );
      float signedNoise =
        textureLod(_RotationNoiseTex, noiseUV, 0.0).r * 2.0 - 1.0;
      angle += signedNoise * _RotationNoiseStrength
        * linkedWindFactor(_IsRotationNoiseLinkedToWind.y);
    }
#endif
    pos = _RotationCenter.xy + rot2(pos - _RotationCenter.xy, angle);
  }
#endif

#ifdef _ENTITY_GPU_DESCRIPTORS
  vUV = actorUvIsLocal ? actorRect.xy + aUV * actorRect.zw : aUV;
#else
  vUV = aUV;
#endif
#if defined(_INTERACTIVE_OUTLINE_QUEUED) || defined(_INTERACTIVE_OUTLINE_SHOW)
  pos += INTERACTIVE_OUTLINE_OFFSETS[gl_InstanceID];
#endif
  vec4 vertexColor = aColor * _Color;
#ifdef _ENABLECOLORANIMATION_ON
  {
    float weight;
#ifdef HAS_COLOR_ANIMATION_NOISE
    if (_ShouldColorAnimationApplyNoise > 0.5) {
      vec2 noisePhase = managedNoisePhase(
        uTime,
        _ColorAnimationNoiseTimeSpeed.xy,
        _ColorAnimationNoiseTimeOffset.xy,
        _ColorAnimationNoiseTimeSyncOffset,
        _IsColorAnimationNoiseLinkedToWind.x
      );
      vec2 noiseUV = vec2(
        noisePhase.x + _ColorAnimationNoiseTex_ST.z,
        noisePhase.x * _ColorAnimationNoiseTex_TexelSize.y
          + _ColorAnimationNoiseTex_ST.w
      );
      float signedNoise =
        textureLod(_ColorAnimationNoiseTex, noiseUV, 0.0).r * 2.0 - 1.0;
      weight = signedNoise * _ColorAnimationNoiseStrength
        * linkedWindFactor(_IsColorAnimationNoiseLinkedToWind.y);
    } else {
#endif
      weight = evalColorAnimationWeight(COLORANIM_CURVE, uTime,
        _ColorAnimationFrequency, _ColorAnimationTimeOffset,
        _ColorAnimationTimeSyncOffset, _ShouldSmoothColorAnimation,
        _IsColorAnimationFrequencyLinkedToWind);
#ifdef HAS_COLOR_ANIMATION_NOISE
    }
#endif
    vertexColor = mix(vertexColor, _ColorAnimationFinalColor, clamp(weight, 0.0, 1.0));
  }
#endif
  vColor = vertexColor;
#ifdef _ENTITY_GPU_DESCRIPTORS
  vRect = actorRect;
  vLocal = aUV;
  vWorld = pos;
  vParticleDissolve = actorTextureCode;
  vColorAdd = actorColorAdd;
#else
  vRect = aRect;
  vLocal = aLocal;
  vWorld = pos;
  vParticleDissolve = aParticleDissolve;
  vColorAdd = aColorAdd;
#endif
#if defined(_AREWAVESENABLED) && defined(_ISWAVESSENSITIVE_ON)
  vec4 waveMaskClip = _GlobalWaveMasksTexCamMatrix * vec4(pos, 0.0, 1.0);
  vWaveUV = waveMaskClip.xy * 0.5 + 0.5;
#else
  vWaveUV = vec2(0.0);
#endif
  gl_Position = uViewProj * vec4(pos, 0.0, 1.0);
}
