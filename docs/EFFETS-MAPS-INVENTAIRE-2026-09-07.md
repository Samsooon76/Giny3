# Inventaire des effets de maps

Audit reproductible. Version source `from-audit-2026-09-03`, exporteur `map-effects-1`, schéma effets `1`.

Maps examinées : **17353** (inventaire Unity du 3 septembre 2026, réutilisé le 7 septembre 2026). Le script `client/web/scripts/audit-world-effects.py` peut relire les bundles installés.

## Familles observées

| Famille | Occurrences | Actives | Statut | Maps de référence |
| --- | ---: | ---: | --- | --- |
| `wind_config` | 17353 | 14058 | supported | 154644 |
| `wave_config` | 17353 | 1278 | supported | 154644 |
| `noise_config` | 17349 | 6 | supported | 154644 |
| `postprocess_config` | 17353 | 17326 | supported | 154644 |
| `refraction` | 774 | 774 | supported | 54162245 |
| `particles` | 14199 | 14199 | supported | 154644 |
| `animated_props` | 7244 | 7244 | supported | 152337 |
| `staging_sequences` | 1019 | 1019 | supported | 152337 |
| `shader_wind` | 1929005 | 1929005 | supported | 154644 |
| `shader_wave` | 4955 | 4955 | supported | 154644 |
| `shader_dissolve` | 143160 | 143160 | supported | 154644 |
| `shader_distortion` | 865108 | 865108 | supported | 154644 |
| `shader_emissive` | 64557 | 64557 | supported | 154644 |
| `shader_refraction` | 955 | 955 | supported | 54162245 |
| `shader_rotation` | 1428448 | 1428448 | supported | 154644 |
| `shader_scale` | 134504 | 134504 | supported | 154644 |
| `shader_translation` | 53378 | 53378 | supported | 135169 |
| `shader_color_animation` | 84583 | 84583 | supported | 135169 |
| `shader_texture_offset` | 300 | 300 | supported | 57148161 |
| `shader_outline` | 7579 | 7579 | supported | 154644 |
| `shader_custom_framerate` | 428 | 428 | supported | 144441602 |
| `shader_depth_alpha_clip` | 10 | 10 | supported | 161218562 |
| `pp_bloom` | 8702 | 8702 | render_absent | 154644 |
| `pp_chromatic` | 7 | 7 | render_absent | 163582468 |
| `pp_film_grain` | 1 | 1 | render_absent | 227540992 |
| `paint_shader` | 157906 | 157906 | supported | 154644 |
| `particles_shader` | 112375 | 112375 | supported | 154644 |
| `animator2d_filters` | 0 | 0 | supported | — |
| `animator2d_masks` | 0 | 0 | supported | — |
| `particle_collision` | 0 | 0 | source_missing | — |
| `localized_sounds` | 1179 | 1179 | render_absent | 152337 |

## Ressources absentes

- Props indisponibles : 32
- Références de textures manquantes : 50

Les absences source restent des exceptions visibles. Aucune image de substitution n'est inventée.

## Collisions de particules

Aucun module `isCollisionModuleActivated` n'apparaît dans les 17 353 documents de particules exportés. Les cellules marchables décrivent le déplacement du joueur et ne sont pas utilisées comme colliders visuels.

## Maps de test

- `154010371` — Incarnam [-1,-3] particules + décors animés
- `154644` — vent, vagues, bloom, ShaderWindParameters
- `54162245` — réfraction PaintShaderData + ShaderRefractionParameters
- `152337` — séquences de mise en scène
- `229651207` — MapNoiseModifierConfiguration
