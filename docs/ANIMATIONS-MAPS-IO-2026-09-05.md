# Animations de map et objets interactifs — 5 septembre 2026

## Résultat

Les props Animator2D déjà extraits jouent maintenant leurs clips. Le rendu conserve le chargement local compressé, les textures partagées, les clips chargés à la demande et le redessin seulement lorsque la scène change. Cette intervention ne réextrait pas le monde et ne modifie pas les règles serveur des métiers.

Avant cette correction, `buildProps` construisait les objets, mais le ticker ne les avançait jamais. Le choix alphabétique du premier clip pouvait afficher une illustration ou une animation de départ à la place de la pose attendue. Les I/O changeaient directement de pose sans lire leurs transitions.

## Comportement implémenté

- Choix initial selon l’état serveur, le nom par défaut lorsqu’il est disponible et les clips usuels des props. Le champ `play_animation` permet de sélectionner `AnimStart` pour les décors concernés. Le préparateur conserve désormais `default_animation_name` pour les prochaines générations de données.
- Lecture à la cadence du clip. Le lecteur avance directement à la bonne image, même après un long délai, et ne reconstruit pas les meshes si l’image reste identique.
- Suspension des props hors du viewport, avec une marge de 128 unités de map. Reprise lorsqu’ils redeviennent visibles ; leur temps d’animation est suspendu hors écran. Les props ne sont pas avancés lorsque le document est masqué.
- États `AnimStateN_0` : lecture une fois, puis maintien de la dernière image ; l’état 2 boucle. Les transitions `AnimStateA_to_AnimStateB_0` se jouent une fois avant l’état cible. Le premier état reçu est appliqué directement.
- Les changements successifs d’état invalident les chargements précédents. Un clip de transition dont le chargement échoue retombe sur l’état cible. Un état absent conserve la représentation disponible.
- Un objet dont le chargement échoue ne bloque plus la construction des suivants.

## Revue des I/O

Le contour blanc existant reste mutualisé : un seul objet le porte à la fois. La mise en évidence conserve les autres filtres de l’objet et demande explicitement un redessin quand le pointeur quitte celui-ci.

La détection des meshes convertit désormais les coordonnées de map dans le repère du mesh avec les transformations à jour. Elle ne confond plus ces coordonnées avec celles de l’écran après zoom ou déplacement de caméra. Les boîtes de détection suivent les changements de géométrie, avec un cache invalidé uniquement quand l’image change. La priorité existante à la cellule de l’objet et le départage par petite boîte sont conservés.

Les I/O statiques reflètent désormais aussi leur disponibilité. La variation d’opacité conserve l’opacité d’origine. Le cheminement vers l’objet et la confirmation de déplacement restent en place ; le cas où aucun chemin local ne démarre ne lit plus un timer avant son initialisation.

L’action en cours est identifiée par l’ID de l’objet. La fin d’utilisation d’un autre objet ne libère plus cette action par erreur.

## Comparaison locale avec Bubble

Inspection du bundle Bubble précédemment extrait, fichier `x-D8TUb0j1.js.pretty` : fonctions `Ig`, `Ag`, `wg`, `_applyStaticStateAnimation` et `_getAvailableStateTransitionSymbolId`.

Bubble sélectionne également les clips selon les états serveur et les options d’animation du décor. Il joue les transitions une fois, conserve ensuite l’état cible et boucle l’état 2. Son rendu calcule l’image depuis le temps du clip et réutilise des données par image. Il possède également une gestion des délais entre animations et de plusieurs familles d’effets que notre rendu n’implémente pas encore complètement.

## Validation

- Suite client complète : **462 tests dans 73 fichiers**, puis **un test supplémentaire** validé pour la suspension hors écran et le renouvellement des boîtes après changement de forme (5/5 dans `interactiveState.test.ts`).
- Les nouveaux tests couvrent la cadence, les grands délais, les clips d’une image, les transitions, les états successifs pendant un chargement, les flips, le survol après pan/zoom, l’opacité des I/O statiques, les actions concurrentes et la conservation des filtres.
- Build TypeScript + Vite de production réussi.
- Test Electron natif `e2e/map-animation.spec.ts` réussi avec extraction au runtime désactivée. Map **54525971**, prop **3507**, `AnimStart_0` de **140 images** : progression de l’image 0 à 2 et du compteur de géométrie 1 à 3, puis rendu effectif constaté. Aucune erreur JavaScript.
- Sur ce lancement Apple M4 : scène **197 ms**, préparation complète **420 ms**, textures retenues **32 021 268 octets**, identiques entre les deux mesures. C’est une vérification fonctionnelle ponctuelle, pas une mesure de fluidité à long terme.
- Capture et mesures : `client/web/output/performance/map-animation.png` et `.json`.

## Limites confirmées

Le catalogue actuel contient 609 types de props préparés. Parmi les 127 types exportés mais non préparables, **114** n’ont aucun clip décodé et **13** ont des clips sans géométrie exploitable. Échantillons relus dans les bundles source : tags binaires non pris en charge `0xd1` (2743), `0xd7` (2728), `0x55` et `0x5d` (3222). Les bundles originaux sont conservés pour poursuivre le décodeur ; aucune taille de record n’a été inventée pour contourner les erreurs.

Les 13 références dont le bundle source est absent restent absentes. Les couches `animated` de `map.elements`, `particles` et `refraction` restent exclues par `mapScene` : elles ne sont pas équivalentes aux props Animator2D de `map.props` corrigés ici. Les sons et événements embarqués dans les clips ne sont pas exécutés. Les cycles avec délais spécifiques de certains décors restent à compléter.
