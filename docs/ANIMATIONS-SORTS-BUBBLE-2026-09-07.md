# Animations de sorts — intégration Bubble, 7 septembre 2026

## Cause des animations absentes

`CombatScene` ne jouait que le geste du lanceur. Les GFX référencés par les SpellScripts n'étaient pas instanciés. Les looks composés contenaient les poses statiques et les déplacements, mais pas les bundles d'attaque de classe. Le décodeur utilisé pour les props ignorait également les slots de personnalisation des personnages (un identifiant de sprite négatif ne signifie pas que le slot est absent).

## Code repris et adaptation

`client/web/scripts/import-bubble-spell-sequences.py` extrait directement du `resources/app.asar` local les parseurs de scripts natifs (type 9), les scripts historiques de types 1/2, la géométrie des traînées et les calculs de durée/rotation des projectiles. L'intégrité SHA-256 des deux chunks source est vérifiée avant l'import. Le résultat est `bubbleSpellSequences.js` ; les empreintes sont dans `public/combat-assets/spell-sequences-provenance.json`.

`spellSequence.ts` relie ces parseurs au catalogue et aux événements Giny. `SpellEffects` présente leurs étapes avec les meshes, textures, matrices et couleurs extraits de l'installation officielle. Il respecte les groupes parallèles et leurs politiques de fin, place les impacts et les traînées sur les cellules, et prépare les textures avant le geste. La vitesse du projectile utilise les unités de Bubble, avec son arc sinusoïdal et sa tangente pour l'orientation.

Le lecteur d'entités conserve les événements des clips. Le marqueur SHOT libère l'effet quand la frame correspondante a effectivement été jouée, même si le ticker ralentit. Le reste du geste continue jusqu'à sa fin. Les annulations, remplacements de pose et destructions ne laissent pas de minuterie active. Les effets directionnels utilisent la résolution et les miroirs du lecteur d'entités ; les FX_0 non directionnels restent lisibles.

Le catalogue de ressources préparées couvre 19 classes, le bundle partagé de combat, 3 404 GFX et 7 095 clips chargés individuellement. Dix looks précomposés fournissent leurs correspondances de skins et sélections de feuilles ; les autres slots disponibles sont liés par leur nom officiel. Les slots vides d'équipement ne reçoivent aucun graphisme inventé.

## Régénération

Depuis la racine du projet : `python3 client/web/scripts/import-bubble-spell-sequences.py`.

Depuis `client/dofus3`, avec l'environnement Python/UnityPy du projet : `../../.local/catalog-venv/bin/python -m extractor.entities.export_spell_assets --all --workers 4`.

`--breeds all` limite aux sorts de base des classes ; `--breeds 1` limite aux sorts de base du Féca. `--spells <ids séparés par virgules>` ajoute des sorts spécifiques. `--all` prépare les références de tous les sorts du catalogue, y compris hors classes. Les ressources absentes sont enregistrées dans `entities/combat-assets.json`, sans image de substitution.

## Validation et limites

Vérification visuelle dans l'atelier déconnecté `?ui-preview=hud&combat-preview=effects` : sélection puis lancement de Retour du bâton, geste AnimAttaque110 complet, impact 8224 visible et retour à la pose statique. La texture 8224-0.png répond HTTP 200. Aucun serveur Giny n'a été redémarré pour ce travail.

Contrôle des 7 095 clips (JSON lisible, frames dessinables et références de parties valides) et des 3 424 textures du manifeste : aucun fichier manquant. Tests ciblés des slots natifs, de SHOT, des séquences, des traînées, des scripts historiques et des projectiles. Compilation TypeScript/Vite réussie ; suite Vitest après le correctif des refus : 580 tests réussis et 1 ignoré. Un test dédié vérifie que la clôture normale d’une action ne coupe pas ses effets `dont-wait` ; leur durée reste liée aux frames effectivement jouées.

Ce changement ne porte pas l'intégralité du client Bubble : les sélections complexes de plusieurs usages (masques/états, groupes aléatoires, portails), les mises en scène `staging`, les effets persistants de glyphes et les sous-entités montées restent à raccorder complètement. La préparation des ressources d'une classe ne constitue pas une validation visuelle de chacun de ses sorts. Les références dont les bundles manquent dans l'installation restent détaillées dans la section `unavailable` du manifeste.

La suite Python élargie signale un échec dans `test_material_table_and_element_export_named_uniforms` (`frequency`, export de matériaux de carte), hors fichiers et chemin de code modifiés pour les sorts : 113 réussites, 4 ignorés, 1 échec. Les 13 tests Python ciblant les changements et leurs régressions immédiates passent.

## Correctif des signalements de 19 h 53–54

Le chat traitait chaque `GameActionFightNoSpellCastMessage` comme un échec du joueur. Or `Fighter.OnSpellCastFailed` diffusait aussi les échecs de l'IA à tous les participants. Ce paquet contient un identifiant de niveau de sort, sans identifiant de lanceur.

Le serveur adresse désormais le refus au personnage concerné (ou au contrôleur d'une invocation). Le client conserve les demandes de lancer effectivement envoyées : il ne journalise qu'un refus correspondant à une demande en cours, pendant le bon combat et le bon tour. Un succès, un échec déjà consommé, un envoi interrompu, une déconnexion ou un changement de contexte invalident la demande. Une expiration de dix secondes évite de conserver indéfiniment une demande sans réponse. Cette protection client fonctionne également avec l'ancien serveur encore en exécution.

Les effets officiels 830, 3385 et 3710 étaient absents de l'export limité aux sorts de base des classes. Ils ont été extraits de leurs bundles officiels. Vérification HTTP via le serveur local du client : 830 = 1 clip / 45 frames ; 3385 = 1 clip / 20 frames ; 3710 = 4 clips / 88 frames. Les trois textures PNG sont accessibles et les clips contiennent des frames dessinables. Cela vérifie les ressources et leur distribution, sans prétendre valider visuellement tous les sorts de monstres.

L'export complet des 3 422 références de GFX s'est terminé : 3 404 préparées et 18 indisponibles (bundles absents ou sans SkinAsset exploitable, détails dans le manifeste). Aucun graphisme de substitution n'est utilisé. L'export complet peut être accéléré avec `--all --workers 4`. Chaque worker prépare un bundle distinct ; seul le processus parent publie le manifeste, par remplacement atomique. Une session déjà ouverte conserve son manifeste en mémoire : recharger le client après la préparation.

Validation du correctif : 580 tests client réussis, 1 ignoré ; compilation TypeScript/Vite réussie ; 47 tests serveur réussis, 7 ignorés ; 2 tests Python des slots d'animation réussis. Aucun serveur de jeu n'a été redémarré : le changement de routage côté serveur prendra effet au prochain redémarrage, tandis que le filtrage client prend effet au rechargement. Les ports locaux 8443 et 5555 étaient de nouveau en écoute lors du diagnostic du refus de connexion historique de 19 h 52.
