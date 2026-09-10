# Suivi des corrections de l’audit — 8 septembre 2026

**État courant : le travail se poursuit ; les 13 points demandés ne sont pas tous clôturés.** Le tableau ci-dessous donne leur état dans l’ordre demandé. Les sections suivantes conservent l’historique des passes : leurs chiffres et leurs limites correspondent à la date de chaque validation. Les états de particules mondiaux ont été installés ; la publication complète des atlas et des autres assets reste à faire.

## Les 13 points demandés, dans l’ordre

| Point | État actuel | Travail restant |
|---|---|---|
| F31 | Corrigé et validé | Aucun sur le périmètre décrit dans la clôture. |
| F05 | Corrigé et validé | Aucun sur le périmètre décrit dans la clôture. |
| F22 | Corrigé et validé | Aucun sur le périmètre décrit dans la clôture. |
| F07 | Corrigé et validé | Aucun sur le périmètre décrit dans la clôture. |
| F08 | Corrigé et validé | Aucun ; préparation mondiale vérifiée et installée. |
| F10 | Corrigé et validé | Aucun sur la comptabilisation/admission ; la VRAM totale du pilote n’est pas mesurée. |
| F21 | Corrigé et validé | Aucun sur le périmètre décrit dans la clôture. |
| F25 | Corrigé et validé | Métriques, vrais seuils et interactions vérifiés ; 31 cycles/124 relevés en 10,2 minutes. La validation du jeu complet sur macOS reste F36. |
| F13 | Abandonné | Décision utilisateur après comparatif local : moins d'appels de dessin, mémoire accrue, pas de gros gain FPS démontré, et défaut de découpe sur 154644. Génération arrêtée, sorties non publiées supprimées, retrait du pipeline mondial. Les atlas déjà publiés restent conservés. |
| F20 | Partiel | Aberration chromatique et grain validés ; bloom et vagues raccordés avec contrôles WebGL et cartes réelles. Capture HDR et premières branches émissive, couleur, UV directionnelles et découpage alpha raccordées. Restent leurs variantes non prises en charge, contour, cadence, dissolution/distorsion des décors, limites des vagues et séquences. |
| F33 | Partiel | 808 dépendances distinctes restent absentes après récupération de sept textures BC7 du cache Bubble ; publication et vérification complètes restantes. |
| F36 | Corrigé et validé sur macOS | Parcours intégré combat/focus/trente transitions réussi en 601,0 s ; masquage pendant un changement de carte puis restauration également validés. Codes 0, captures et nettoyage vérifiés. Les actions combat/téléportation sont pilotées par protocole ; ciblage manuel et Windows non couverts. Échec antérieur conservé avec sa limite de diagnostic. |
| F35 | Corrigé et validé | Découpage par responsabilités, manifeste, compilation UI, chargement différé, strict et couverture CSS traités. Parcours intégré réussi sur le bundle final : combat, trois cycles de focus, trente transitions en 601,0 s. Les échecs intermittents antérieurs restent suivis dans F36. |


## Dernier constat vérifié

**F20/F33 — dissolution/distorsion et vérification des dépendances.** `MaterialSampling` partage les branches locales de dissolution/distorsion entre décors et particules : bruit rouge scalaire, masques, seuil centré, fondu, couleur de bord, vitesse multipliée et UV limitées à la portion d’atlas. Les variantes aléatoires, bruitées et UV écran/monde restent non prises en charge ; F20 reste partiel. La carte 149163014 a été chargée directement comme témoin visuel, sans preuve qu’il s’agit d’une carte d’exploration ou de combat. Capture inspectée, zéro erreur de console. Validation : 766 tests client / 1 ignoré, 28 contrôles de pixels (décors et particules, résolutions 1 et 2), 18 scénarios WebGL existants et 17 tests d’export/vérification réussis. Preuves : `f20-sampling-full-tests.log`, `f20-sampling-webgl.log`, `f20-particle-sampling-webgl.log`, `f20-sampling-regression-webgl.log`.

**Précision F33 après la remarque sur les cartes de combat.** La vérification des 17 353 cartes retrouve 808 chemins manquants (3 553 références). Une analyse des 768 cartes concernées distingue 14 chemins uniquement présents dans des matériaux non utilisés et 794 encore référencés par les éléments, matériaux de staging, environnement, particules, réfraction, séquences ou gfx exportés. Ce contrôle conservateur ne prouve pas que ces 794 chemins sont tous visibles, ni que les cartes concernées sont des cartes de combat. Il corrige l’interprétation précédente : 808 fichiers manquants ne signifie pas 808 défauts visibles. Preuves : `f33-current-release-verification.json`, `f33-live-dependency-analysis.json`. Le contrôle de publication inclut maintenant les dépendances d’effets et recalcule la couverture avec le contrat actuel du moteur, au lieu de reprendre un ancien drapeau `effects_complete`.

**Point de livraison — 20 h 43, macOS uniquement.** Dix des treize points sont clôturés. F13 reste en génération (5 344 / 17 353 cartes vérifiées au relevé), F20 conserve les limites détaillées ci-dessous et F33 attend 808 dépendances sources absentes. Ces trois points ne sont pas déclarés terminés. La génération mondiale demeure active ; ses sorties ne sont pas encore publiées.

**Dernier correctif :** les textures de dissolution/distorsion des particules sont résolues par catégorie, identifiant et référence du matériau. Un identifiant numérique de particule ne peut plus remplacer un bruit du même numéro ; une référence dédupliquée de la même catégorie reste acceptée. Les quatre tests de paramètres et la compilation TypeScript passent après ce changement. La dernière suite complète antérieure compte 762 réussites / 1 test ignoré ; les 18 scénarios WebGL passent. Le parcours natif F36 précède les derniers ajouts F20 et ne constitue donc pas leur validation intégrée finale.

**F20 — couleur, UV directionnelles et découpage alpha raccordés aux décors.** `MapMaterialShader` remplace `EmissiveMaterial` et mutualise ces branches avec l’émissif et la déformation GPU. La couleur interpole le RGBA avant la multiplication par la texture et le facteur RGB ×2 ; elle respecte phase, formes sinusoïdale/triangulaire/rampe/fixe et lien de fréquence au vent. Le défilement local applique le tiling, l’offset et la vitesse directionnelle négative confirmés par ApplyTextureOffsetToMaterial. Le découpage compare l’alpha après coloration au seuil exporté, avant émission. Les variantes fixes ne forcent pas de rendu continu.

Dix-huit tests WebGL réussis aux résolutions 1/2, dont pixels de couleur/alpha, lien au vent, sens du défilement, répétition confinée à l’atlas, tiling et seuil après teinte. Suite client : 762 réussites, un ignoré ; douze tests d’export, TypeScript et build production réussis. Carte 149163014 : huit instances de couleur, capture finale inspectée après disparition de `.loading-screen`, zéro erreur console. Quatre avertissements concernent ses voisines non préparées. Les compteurs distinguent les instances réellement rendues des paramètres présents au catalogue. Preuve consolidée : `f20-color-uv-validation.json`. Navigateurs de contrôle fermés.

**Limites restantes de ces branches :** couleur bruitée/modulée par le bruit de carte, flowmap, UV écran/monde, et matériaux de particules. Leur statut est `semantics_unknown`, pas une déclaration de support complet. La vérification bornée de 500 cartes n’a fourni ni témoin UV ni témoin de découpage alpha ; elle ne prouve pas leur absence mondiale. Les enums et champs sont vérifiés dans les métadonnées natives ; les instructions de configuration sont conservées dans `f20-material-offset-native.txt`. La cadence personnalisée n’est pas implémentée : ApplyFramerateToMaterial confirme un paramètre de shader, sans établir à lui seul sa formule temporelle. F20 reste ouvert avec ses autres branches.

**F20 — première branche émissive des décors raccordée.** `EmissiveMaterial` applique le mélange RGBA de la texture émissive avec la couleur et le facteur du matériau, puis prémultiplie sans écrêter les hautes lumières. L’animation sinusoïdale utilise fréquence, décalage et bornes exportés. Les coordonnées locales de l’émissif sont séparées des UV d’atlas de l’albédo ; les huit coefficients existants de déformation GPU sont conservés. Les textures restent empruntées, les buffers/shaders possédés sont libérés. Un matériau statique sans déformation ne force pas de rendu continu. Les variantes avec retards par zone, bruit de fréquence ou facteur lié au bruit de carte restent refusées plutôt que remplacées par une approximation.

Quatorze tests WebGL passent ; les deux contrôles émissifs finaux vérifient aussi le repos statique, les pixels d’atlas, la déformation GPU, les deux extrêmes d’animation, l’immutabilité du document et les textures empruntées. Suite client finale : 758 réussites, un ignoré ; douze tests d’export réussis ; TypeScript et build production réussis. Sur la carte 166988802, quatre instances émissives sont créées ; capture inspectée, zéro erreur console. Quatre avertissements concernent exclusivement ses cartes voisines non préparées. Navigateur fermé. Preuve : `f20-emissive-validation.json` et `f20-emissive-final-build.log`.

La couverture émissive passe de `render_absent` à `semantics_unknown` dans les nouvelles et anciennes cartes. Elle reste partielle : variantes retardées/bruitées, particules émissives et fidélité native complète non validées. Les autres branches de matériau manquantes et les séquences restent ouvertes ; F20 n’est pas clôturé.

**F20 — correction des déclarations de prise en charge.** La table de l’exporteur déclarait encore plusieurs familles `supported` sans consommateur graphique. L’exporteur et l’adaptateur des anciennes cartes marquent maintenant l’émissif, l’animation de couleur, le décalage de texture, le contour de matériau, la cadence de matériau et le découpage alpha/profondeur `render_absent`. Dissolution et distorsion restent `semantics_unknown` : leur branche particules existe, leur branche générale de décor manque. Les configurations de post-traitement et les séquences passent à `semantics_unknown`, puisque leurs consommateurs existent partiellement. La présence du contour interactif ne prouve pas le support du paramètre de matériau ShaderOutlineParameters.

Le test des anciens documents couvre ces familles et passe ; les douze tests d’export passent. Cette correction rend le diagnostic fidèle au code ; **elle n’implémente pas les shaders absents**. Leur réalisation reste dans F20. Preuves : `f20-material-coverage-tests.log`, `f20-material-exporter-tests.log`. Le périmètre F20 ne se réduit donc pas au bloom, aux vagues et au dispatch : ces anciennes listes de restes étaient incomplètes.

**F20 — capture HDR intégrée.** Le monde est capturé une seule fois en RGBA16F lorsque le bloom est actif et que WebGL expose `EXT_color_buffer_float`. Une représentation temporaire de la capture évite de redessiner tous les objets ; le filtre final et la pyramide lisent directement la source flottante, sans repasser ses valeurs par le pool RGBA8. Les enfants retrouvent leur visibilité/rendu initial, même si le dessin échoue. La cible est réutilisée, remplacée au redimensionnement, puis libérée à la désactivation, au changement de carte et à la destruction. Sans prise en charge HDR, le diagnostic et le repli LDR restent explicites.

Douze tests WebGL réussis : hautes lumières additives et halo au-dessus de l’ancien plafond, neutralité avec seuil hors plage, caméra, interface, restauration après erreur, libération et régressions bloom/grain/chromatique/vagues/réfraction. Build production et TypeScript réussis. Sur la carte 154644 : entrée HDR confirmée, deux vagues actives, carte affichée, zéro erreur console ; 7 372 800 octets pour la capture et 4 913 600 pour la pyramide. Ces allocations sont incluses dans le compteur des cibles de rendu. Capture inspectée et navigateur fermé. Preuves : `f20-hdr-validation.json`, `f20-hdr-regression-webgl.log`, `f20-hdr-build.log`.

**Restes F20 :** la capture HDR ne remplace pas les shaders émissifs encore absents et ne prouve pas une composition des couleurs identique à Unity. Le dispatch des séquences de carte reste sans correspondance identifiée dans le protocole serveur 2.68 ; les messages SequenceStart/End sont des séquences de combat et ne sont pas branchés arbitrairement. La piste staging des scripts de sorts désigne des séquences globales numériques, distinctes des catalogues de carte ; leur présence ne fournit pas cette correspondance. Les limites de projection des vagues restent documentées. F20 demeure partiel.

**F20 — bloom raccordé et vérifié, HDR encore incomplet.** `BloomPyramid` ajoute une pyramide gaussienne à demi-résolution, limitée à six niveaux, avec seuil adouci en lumière linéaire, scatter, intensité et teinte native ARGB normalisée. Les cibles RGBA16F sont réutilisées et détruites au changement de dimensions/carte, à la désactivation et à la destruction. Le monde est recomposé avant le grain, hors interface et après les captures de réfraction. La teinte sérialisée `{value: ...}` est prise en charge. Aucun facteur arbitraire d’atténuation n’est ajouté.

**Preuves de cette passe :** dix tests WebGL de régression réussis ; deux tests bloom finaux aux résolutions 1/2 couvrent couleurs, seuil, halo, interface inchangée, désactivation et libération. Suite client : 757 réussites, un ignoré ; douze tests d’export réussis. Les corrections finales couleur/seuil ont leurs tests ciblés, `tsc -b` et build production réussis. Carte 172229124 inspectée : bloom actif, six niveaux, 4 913 600 octets de cibles, aucun chargement persistant ni erreur console. Carte 154644 : le seuil nécessite une entrée HDR ; zéro cible/allocation bloom, ce qui évite des passes entièrement noires. Preuve consolidée : `f20-bloom-validation.json`, capture `f20-bloom-real-map.png`.

**Limite qui empêche la clôture de F20 :** la capture du monde reste RGBA8 et les matériaux émissifs HDR ne sont pas raccordés. Les intermédiaires flottants ne recréent pas les hautes lumières perdues en entrée. Le diagnostic conserve `pp_bloom=semantics_unknown` ; aucune fidélité native complète ni amélioration FPS n’est annoncée. Le scan mondial des paramètres est terminé (8 702 cartes avec bloom actif) ; le navigateur de validation est fermé. La génération des atlas demeure le traitement long actif.

**F20 — dynamique des vagues et références partagées contrôlées.** Les tests WebGL des vagues vérifient maintenant quatre instants de la LUT de dynamique et la sélection de la couleur dissoute près de la première frontière, aux résolutions 1 et 2. Les deux scénarios passent. Les slots de dissolution réutilisent correctement une référence dédupliquée de la même catégorie ; un identifiant identique de particule ou de LUT ne peut pas la remplacer. Sept tests de liaison/couverture, douze tests d’export et `tsc -b` passent. Le diagnostic de couverture passe de `render_absent` à `semantics_unknown` pour les vagues : le rendu existe, sa fidélité complète n’est pas encore prouvée. Références : `f20-wave-temporal-webgl.log`, `f20-wave-bindings-tests.log`, `f20-wave-exporter-tests.log`.

**F20 — premier rendu de vagues raccordé, validation encore partielle.** `WaveMapMesh` reprend les quatre régions, distorsions et dissolutions du shader archivé. Géométrie fixe, horloge du ticker existant, textures empruntées aux leases de carte ; le profil économique fige l’animation. Le masque mondial est chargé explicitement. Les deux LUT de dynamique passent par un chargement RGBA sans prémultiplication ni conversion colorimétrique, car leurs quatre canaux représentent des données.

Huit tests WebGL passent : quatre régions et absence de couverture aux résolutions 1/2, rejet des textures absentes, cycle de vie et textures empruntées, plus régressions réfraction/chromatique/grain. Trois tests du chargeur RGBA et dix-neuf tests d’intégration passent. Build production et `tsc -b` réussis. Carte 154644 inspectée, deux instances de vagues créées, aucun écran de chargement ni erreur de shader capturée. La suite complète a donné 751 réussites, un test en échec et un ignoré : le test particules supposait l’ancien démarrage automatique ; il sélectionne maintenant explicitement OFF et ses 17 tests passent après correction. Preuve : `f20-wave-validation.json`.

**Limites conservées :** l’aspect de projection est déduit du masque et le centre suit le prefab ; leur équivalence avec la caméra native à l’exécution n’est pas encore démontrée. La comparaison pixel à pixel native et les tests de référence des distorsions/dissolutions animées restent à faire. Les vagues ne sont pas promues en prise en charge complète ; F20 reste partiel, avec bloom et dispatch des séquences encore ouverts.

**F13 — blocs BC7 identiques encodés une seule fois.** L’encodage conservait le profil alpha_basic mais recalculait chaque bloc 4×4, y compris les zones transparentes répétées. Une déduplication bornée à la page encode chaque bloc unique puis restitue l’ordre original. Les pages denses gardent l’encodage direct. Sur quatre pages réelles : 44,3 s → 13,7 s pour le BC7, résultat identique octet par octet ; aucun changement de qualité, taille de fichier, placement ou pixels. Ce gain concerne l’encodage mesuré, pas les FPS ni toute la durée mondiale. Trois tests passent : blocs vides/denses/répétés, dernière rangée incomplète, équivalence binaire, concurrence et publication atomique.

Le traitement précédent a été interrompu volontairement (sortie 130 confirmée), puis repris après les tests. Journal actif : `f13-world-atlases-deduplicated-bc7.log` ; les anciens lots sont revérifiés et leurs pages réutilisées. Preuves : `f13-bc7-block-dedup.json`, `f13-bc7-dedup-tests.log`. La piste WebP rapide est abandonnée : elle augmentait certains fichiers de 15–20 % et le BC7 dominait le coût. Le contrôle de réserve disque de 4 Gio reste actif.

**F20 — déclenchement automatique erroné des séquences supprimé.** `MapEffects.prepare` charge maintenant le catalogue sans lancer sa première entrée. `playSequence(id)` sélectionne explicitement une séquence, refuse les identifiants absents et les appels hors cycle de vie ; une carte nouvellement chargée reste inactive. Le compteur d’effets distingue catalogue et lecture. Dix tests ciblés passent, dont absence d’événement au chargement, sélection de ON au lieu de OFF, identifiant invalide sans interruption de la lecture et annulation au changement de carte. `tsc -b` passe. Journaux : `f20-explicit-sequence-tests.log`, `f20-explicit-sequence-types.log`. **La commande n’est pas encore reliée au dispatch des événements du jeu ; les séquences restent incomplètes et ne démarrent plus arbitrairement.**

**F33 — sept textures récupérées dans le cache Bubble.** Lecture des 256 shards du manifeste : correspondances exactes par catégorie et identifiant pour six particules (2003, 2034, 2203, 2205, 2216, 2217) et l’émissive 2203. Les packs et chaque payload BC7 ont été vérifiés par SHA-256 ; décodage RGBA, inspection visuelle puis installation vérifiée dans le cache source mondial et `game-data`. Les PNG originaux ne sont pas disponibles : ces fichiers conservent les pertes de la compression BC7 existante, sans nouvelle compression destructive. Provenance livrée dans `effects/recovered-bubble-textures.json`. Preuves : `f33-bubble-qualified-candidates.json`, `f33-bubble-recovered-preview.png`, `f33-remaining-after-bubble.json`. **808 des 815 dépendances initialement absentes restent à résoudre.** Les chiffres 815 des anciennes investigations ci-dessous sont historiques.

**F20 — contrat des vagues retrouvé, rendu encore absent.** Les shaders Bubble archivés contiennent le calcul complet des quatre régions d’eau, distorsions et dissolutions. La carte 154644 possède trois matériaux concernés et les six fichiers de textures requis. Le binaire macOS confirme les couleurs ARGB /255 et révèle que la matrice enregistrée est remplacée au chargement par la projection d’une caméra de masque, réglée temporairement à une demi-hauteur de 688. Son centre et son aspect restent à vérifier avant intégration ; appliquer directement la matrice exportée serait incorrect. Preuves ciblées dans `f20-wave-render-contract.md`, `f20-wave-update-callers.txt` et `f20-wave-camera-methods.json`. Aucun rendu de vagues n’est annoncé à ce stade.

**F20 — grain raccordé et contrôlé.** Les dix textures Alpha8 natives sont extraites sans modification de leur canal alpha ; le preset 0 est conservé. Le rendu reprend le calcul URP en lumière linéaire, son intensité ×4 et son échantillonnage LinearRepeat à la résolution physique. La texture appartient au chargement de la carte centrale ; les préchargements voisins ne la demandent pas. Aucun bruit de substitution en cas de texture absente. Le profil économique désactive le post-traitement et aucune animation supplémentaire ne tourne en fenêtre masquée.

Preuves : six tests WebGL réussis (dont grain aux résolutions 1 et 2, référence CPU, neutralité, animation et propriété des textures), 748 tests client réussis et un ignoré, 16 tests d’export réussis, build production réussi. La seule carte à grain actif trouvée parmi les 17 353 documents, 227540992, charge bien le preset 5 : intensité 0,833, réponse 0,422, texture présente, 16 940 applications relevées. Capture inspectée : grain et aberration visibles, aucun écran de chargement (`f20-grain-validation.json`, `f20-grain-real-map.png`). Les décalages aléatoires ne reproduisent pas la suite pseudo-aléatoire Unity ; aucune identité pixel à pixel avec le client officiel ni amélioration FPS n’est annoncée. Bloom, vagues et séquences restent ouverts.

**F13 — encodage concurrent borné, génération reprise.** Quatre tâches d’encodage maximum, un seul écrivain par hash de page, publication du manifeste après réussite de toutes les tâches. Les placements et pixels ne changent pas. Mesure sur quatre pages réelles : 30,8 s en série, 14,7 s en concurrence, fichiers identiques (`f13-encoding-concurrency.json`). Deux tests vérifient la concurrence, les découpes exactes, l’équivalence binaire et la conservation du manifeste en cas d’échec. Le compte de pages par lot a également été corrigé : il ne cumule plus les anciens lots. Le processus précédent a été interrompu volontairement, puis repris après validation ; les pages existantes ont été réutilisées. Journal actif : `f13-world-atlases-concurrent.log`. Dernier checkpoint : 1 824 / 17 353 cartes ; aucune publication globale annoncée.

**F20 — aberration chromatique appliquée.** Nouveau `MapPostProcess`, exécuté une seule fois sur le monde après les captures de réfraction, hors interface. Paramètre issu de la carte, borné comme le volume URP, désactivation avec le profil économique et retour neutre sans filtre. Le facteur 0,05 est confirmé dans le binaire installé (`SetupChromaticAberration`, adresse 0x53014a8) ; l’échantillonnage des trois canaux suit [la source Unity URP](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.universal/Shaders/PostProcessing/UberPost.shader). Les tests ont corrigé deux défauts avant validation : résolution du filtre et conversion de la zone de capture à travers la caméra.

Preuves : quatre tests WebGL réussis, dont comparaison à la formule de référence aux résolutions 1 et 2 avec caméra centrée/zoomée, désactivation neutre et régressions de réfraction ; 745 tests client réussis, un ignoré ; 15 tests d’export réussis ; build production réussi. Carte 163580420 affichée entièrement, intensité 0,403 et 1 792 applications relevées, capture inspectée (`f20-chromatic-validation.json`, `f20-chromatic-real-map.png`). La couverture distingue maintenant cette famille des effets encore absents. Cette preuve ne constitue pas une comparaison pixel à pixel avec une capture du client Unity ni une mesure de gain FPS. F20 reste partiel.

**Contrôle natif du changement de carte en fenêtre masquée réussi** (`f36-hidden-transition/f36-native-game-focus-result.json`) : destination 153878788 entièrement construite (`built`) alors que document.hidden=true, sans marqueur de présentation ; restauration de la fenêtre, puis destination affichée et écran de chargement retiré. Sortie 0, nettoyage confirmé. Ce comportement explique pourquoi une attente de présentation peut expirer en arrière-plan ; il ne prouve pas rétrospectivement que l’échec ancien avait cette cause, car sa visibilité n’avait pas été enregistrée. Le banc indique désormais visibilité et dernière étape dans son diagnostic de délai dépassé. Le parcours intégré et ce scénario ciblé clôturent le périmètre macOS de F36 ; aucune correction spéculative du rendu n’a été ajoutée.

**Parcours intégré réussi sur le dernier bundle** (`f36-stage-diagnostic/summary.json`) : combat terminé, trois cycles de focus avec reprise WebGL, trente transitions en 601 008 ms, temps de disponibilité maximal 721 ms, zéro erreur JS capturée pendant l’endurance. Maximum par processus 952,5 Mio ; renderer de 872,8 à 798,2 Mio. Les 6 183 fichiers du bundle sont restés inchangés durant le parcours. Capture finale inspectée, sortie 0 et nettoyage des serveurs/bases temporaires confirmés. Cela clôt la validation intégrée de F35. La cause de l’échec intermittent antérieur n’est pas prouvée ; cette limite historique reste conservée ci-dessus. Les métriques mémoire concernent le working set des processus et ne constituent pas une mesure de VRAM totale ni un gain FPS avant/après.

Diagnostic ajouté au journal client : étapes `map-stage` avant chaque attente de chargement et avant présentation. Build production et sept tests de transitions réussis. La capture de l’échec précédent contient encore l’ancienne image entière alors que le DOM a changé ; l’hypothèse d’une suspension d’affichage en fenêtre masquée doit être vérifiée, pas présentée comme une correction acquise.

Sur un échantillon de 128 cartes déjà préparées, 1 375 textures sources occupent 9 114 emplacements distincts (731 textures répétées, jusqu’à 43 copies). Preuve : `f13-atlas-duplication-sample.json`. Ce coût de génération est mesuré ; aucun changement de placement mondial n’a encore été effectué.

Le parcours intégré précédent (`.local/audit-fixes-tests/f36-final-owned-requests/`) a **échoué**, après six changements de carte réussis : le septième reste sur l’écran de chargement. Le processus est terminé et le nettoyage des serveurs/bases de test est confirmé. La suppression de la requête de snapshot supplémentaire du banc a permis de dépasser le premier changement, mais **ne résout pas tout le blocage**. Aucun nouveau lancement identique n’est justifié sans diagnostic de cette attente. Le checkpoint atlas contient 1 056 cartes sur 17 353 ; ce décompte ne constitue pas une publication validée.

## Recentrage du travail restant

Dix des treize points demandés sont clôturés sur leur périmètre documenté. La validation intégrée de F35/F36 couvre leur bundle de clôture, antérieur au nouveau post-traitement F20. Celui-ci possède ses contrôles ciblés et sa validation de carte réelle ; une validation globale devra suivre la fin des chantiers restants.

1. **F13** : terminer la préparation mondiale, vérifier et publier les atlas. Le traitement actif reste coûteux et contient des placements répétés ; aucun gain FPS n’est déduit du seul nombre de textures regroupées.
2. **F20** : terminer les matériaux émissifs du bloom, vérifier les limites de projection des vagues, puis raccorder les séquences à l’état du jeu. Les transformations/particules déjà raccordées restent partielles ; le démarrage automatique a été supprimé et remplacé par une sélection explicite ; le dispatch depuis les événements du jeu reste à raccorder.
3. **F33** : résoudre les 808 dépendances distinctes encore manquantes, puis vérifier la release complète. Les sources locales examinées n’ont pas fourni les fichiers attendus. Aucune substitution par simple identifiant numérique n’a été installée.

Les sections suivantes conservent l’historique et les limites de chaque passe.

## Stabilisation globale — 8 septembre, 16 h 16

Aucune nouvelle modification du code de production pendant cette passe. Suite client complète : **740 tests réussis, 1 ignoré, 153 fichiers** ; compilation TypeScript et production réussie. Journaux : `.local/audit-fixes-tests/stabilisation-full-tests.log` et `stabilisation-build.log`. Ces contrôles couvrent les derniers ajouts de staging, mais ne prouvent ni leur fidélité visuelle ni leurs performances en jeu.

Atlas : processus de génération interrogé et confirmé actif ; checkpoint de **24 lots, 768 cartes sur 17 353**, avec 21 Gio disponibles. Ce checkpoint ne vaut pas vérification finale ni publication.

La revue confirme un problème encore ouvert dans F20 : `MapEffects.prepare` démarre automatiquement une séquence sans sélection liée à l’état du jeu. Les transformations ajoutées interpolent linéairement ; leur comportement officiel et plusieurs paramètres ne sont pas validés. Il faut résoudre ce contrat avant d’élargir les effets ou d’annoncer leur prise en charge complète.

Ordre de reprise concret :
1. F13 : laisser terminer les lots actifs, vérifier les sorties et dépendances avant publication.
2. F20 : déterminer les déclencheurs et paramètres officiels, corriger leur raccordement puis comparer visuellement les familles manquantes.
3. F33 : identifier les sources des 815 dépendances manquantes ; conserver un échec explicite tant qu’elles ne sont pas réparées.
4. F36 : valider combat complet, focus sans émulation Playwright et endurance du jeu macOS sur environnement isolé.
5. F35 : terminer le découpage utile des classes centrales puis exécuter la validation intégrée finale sur le code obtenu.

Les chiffres ci-dessous sont **historiques** et ne remplacent pas cette vérification globale ni les états du tableau courant.

## Vérifications exécutées

- Client : **645 tests réussis, 1 ignoré** ; TypeScript strict et build production réussis.
- Serveur : **90 tests réussis, aucun ignoré**, tests MariaDB sur bases temporaires isolées inclus.
- Python : **115 tests réussis, 5 ignorés**.
- Electron : **1 parcours multi-cartes réussi**, maps 154644 → 154010371 → 153878788 → 154644 et profil économique, sans erreur JavaScript. Capture finale inspectée. Ce parcours Electron est un aperçu des maps ; un parcours réseau séparé sur des copies temporaires a ensuite validé le HUD, la map et l’entrée en combat (voir troisième passe).
- Atlas : préparation isolée de quatre cartes, 14 pages, aucune carte ignorée, 115,37 secondes. 369 crops vérifiés pixel par pixel identiques aux sources ; les références de textures éligibles passent respectivement de 71/114/100/88 à 4/4/4/6. Ce décompte n’est pas un nombre de draw calls.

Le chunk JS principal passe de 1 298,13 kB à 282,97 kB (gzip 85,50 kB), car les écrans sont séparés en chunks. Cela ne représente pas une réduction équivalente du téléchargement total lors d’une session complète. Aucun pourcentage de gain FPS n’est établi faute de mesure avant/après comparable.

**Limite mémoire observée :** après passage à économique et libération des voisines sur une map déjà chargée, le pool conserve environ 179,8 Mio de textures épinglées pour un budget d’éviction de 128 Mio ; les recolorations utilisées atteignent environ 52 Mio pour un budget de 32 Mio. Les budgets sont des objectifs d’éviction des ressources libres, pas des plafonds de RAM/VRAM.

## Réseau et sauvegardes

| Point | État | Modification et limite |
|---|---|---|
| F01 — Le parseur TCP accepte des données qui ne sont pas arrivées | Corrigé | Parseur atomique sur les octets disponibles, accumulation des fragments et plafond de trame ; tests TCP et IPC. |
| F02 — Les envois TCP ne vérifient pas les octets effectivement envoyés | Corrigé | File FIFO bornée par connexion ; reprise des envois partiels et traitement des erreurs. |
| F03 — L’apparition d’un acteur provoque N² envois | Corrigé | Envoi personnalisé direct au destinataire dans ShowActor et RefreshActorOnMap ; test à 20 destinataires. |
| F27 — La sauvegarde périodique peut acquitter une modification plus récente | Corrigé | Acquittement par génération, modifications pendant l’écriture conservées, échecs retenus ; tests de concurrence et suite SQL réussis. |
| F26 — Le SQL partage une connexion et un verrou global | Corrigé | Transactions, écritures, lectures courantes et requêtes utilisent une connexion possédée par opération, rendue au pool (32 connexions maximum). Test de deux transactions simultanées et lecture indépendante réussi. Le provider historique et les verrous de migration restent disponibles pour le démarrage ; les verrous métier sont conservés. |
| F28 — Les lots ORM et certains index produisent des coûts quadratiques | Corrigé | INSERT/UPDATE/DELETE découpés en lots de 500 dans une seule transaction par appel ; tests de rollback après échec du deuxième lot. Index des objets par propriétaire maintenu atomiquement lors des ajouts, transferts, suppressions et rechargements ; plus de scan mondial pour ouvrir un inventaire. Atomicité SQL garantie pour les tables transactionnelles, pas les anciennes tables MyISAM. |
| F29 — Le dispatch des messages ignore l’accès direct du dictionnaire | Corrigé | TryGetValue et invocation typée ; suppression du parcours LINQ et de DynamicInvoke par message. |
| F30 — Le rechargement d’une map peut laisser son ancien timer actif | Corrigé | Ancien timer détruit avant remplacement ; Dispose tolère un timer jamais démarré. |
| F31 — La réconciliation périodique renvoie des snapshots complets | Corrigé | Cache JSON par connexion/personnage et révision de notifications, réponses unchanged légères, actualisation sur notifications HUD/acteurs regroupées à 100 ms. Polling de secours espacé à 10 s et suspendu lorsque la page est cachée ; reconstruction forcée après 30 s pour les mutations legacy silencieuses. Équipement, porte interactive, reconnexion et entrée en combat vérifiés sur serveurs isolés. La révision conservatrice peut être invalidée par une notification sans changement HUD. |

## Présentation et chargement des maps

| Point | État | Modification et limite |
|---|---|---|
| F04 — La présentation de la carte attend ses quatre voisines | Corrigé | La présentation centrale ne bloque plus sur les voisines ; annulation et contrôle de génération conservés. |
| F05 — La priorité de chargement se perd dans les entités et les props | Corrigé | Contexte propagé aux caches imbriqués, documents préparés/legacy, textures et uploads GPU. Files bornées, promotion vers active et extraction sérialisée sur les deux transports. Documents des props chargés par groupes de trois ; préparation coopérative des instances et recolorations. Tests de priorité/annulation et parcours Electron multi-cartes/profils réussis. |
| F12 — Le cache et la file créent du travail évitable | Corrigé | LRU sans tri, files bornées et promotion ; annulation propagée aux fetchs des maps, looks legacy, props, skins et ressources de combat. Un chargement partagé continue tant qu’un utilisateur attend. Test des deux consommateurs et de l’absence d’extraction après annulation. Les petits manifestes de session restent partagés ; l’attente IPC d’extraction est annulable, le travail natif partagé sur disque continue. |
| F22 — Les échecs temporaires de chargement peuvent rester mémorisés | Corrigé | Manifestes réessayables avec délai borné et expiration ; cartes identifiées par publication/hash/chemin, looks et fallback props par publication. Bouton de reprise sur erreur de chargement, invalidation explicite des manifestes et styles, annulation au changement de destination. Parcours navigateur HTTP 503 → réparation → 1 828 sprites sans rechargement réussi. |

## Simulation et rendu

| Point | État | Modification et limite |
|---|---|---|
| F06 — Les effets hors écran continuent à travailler | Corrigé | Culling avant simulation, suspension des effets/props hors écran ; bornes conservatrices des voisines capturées avant culling pour éviter leur rétrécissement à mesure que des enfants sont masqués. Transitions Electron validées. |
| F07 — Le vent transforme les sommets sur le CPU à chaque tick | Corrigé | Tous les maillages de décor déformés sur GPU dans un lot commun avec les sprites ordinaires. Huit coefficients par objet/image, positions immuables, emplacements réutilisés et libérés. 24 comparaisons de pixels et animation/caméra sans upload de sommets réussies ; dessins mesurés 105/457/407 contre 109/497/444 dans le parcours de référence. |
| F08 — Le préchauffage des particules peut bloquer le chargement | Corrigé | Pool avec parents retenus, triggers et traînées réutilisés, budget commun de préchauffage. États de départ calculés pour les 17 353 cartes : 84 822 variantes vérifiées et installées ; reprise complète sans recalcul. Chargement coopératif annulable, repli borné et validation Electron sur données installées réussis. |
| F09 — La réfraction déclenche une capture même sans effet visible | Corrigé | Effets hors écran et désactivés exclus de la capture ; toutes les passes cachées pendant la capture commune pour éviter le feedback. Targets inutilisés libérés. Tests WebGL de comparaison de pixels à résolutions 1 et 2 réussis, absence de capture hors écran/désactivée vérifiée. |
| F19 — Le combat force des rendus continus et conserve du travail masqué | Corrigé | La scène de combat signale ses changements visuels au moteur ; suppression du dirty inconditionnel. Transitions exécutées par le tick de scène, sans setInterval distinct, avec annulation et fin au destroy. Le marqueur du tour actif et les animations continuent naturellement à demander des rendus. |

## Interface et catalogues

| Point | État | Modification et limite |
|---|---|---|
| F14 — Le catalogue du HUD recharge un ensemble massif sans coalescence | Corrigé | 22 requêtes initiales au lieu de 28 ; succès, métiers/recettes et cosmétiques chargés à l’ouverture de leur fenêtre. Cache commun de JSON décodé pour création, HUD et encyclopédie. Échecs évincés et réessayables ; tests de chargements simultanés, non-duplication et conservation des données déjà hydratées. |
| F15 — Des statistiques non affichées font rerendre le HUD au repos | Corrigé | Statistiques non affichées conservées dans une ref ; suppression du setState périodique dans WorldView. |
| F16 — Les bindings d’inventaire recalculent la même sélection pour chaque nœud | Corrigé | Index inventaire/équipement et niveaux de sorts ; index et filtrage mémorisés de l’encyclopédie. |
| F17 — Les arbres UI sont reparsés et les stores de fenêtres sont trop globaux | Corrigé | Cache borné des arbres UI avec clones par consommateur ; abonnement viewport partagé ; sélecteurs des fenêtres affinés. |
| F23 — Les logs réécrivent tout l’historique pendant les interactions | Corrigé | Persistance des logs regroupée à 500 ms, flush sur erreur et page masquée/quittée. |

## Profils, mémoire et mesures

| Point | État | Modification et limite |
|---|---|---|
| F10 — Le budget de 256 Mio ne représente pas la mémoire de l’application | Corrigé | Compteurs distincts des sources, recolorations, caches/propriétaires documentaires, tas JS et allocations textures/buffers par contexte WebGL. Pression mémoire et plafonds d’admission appliqués ; copies monde/aperçus et libération vérifiées dans Electron. Les payloads GPU déclarés restent distincts de la VRAM réservée par le pilote et des mesures mémoire par processus. |
| F11 — La recoloration duplique des textures sur le CPU | Corrigé | Cache partagé de recoloration avec leases et budget d’éviction ; séparation des textures empruntées et possédées. Les textures utilisées restent conservées même au-dessus du budget. |
| F18 — Les portraits animés multiplient les contextes WebGL | Corrigé | Un renderer WebGL et un ticker partagés entre portraits visibles ; copie vers le canvas 2D propre à chaque portrait, rendu sur changement. Test WebGL : six propriétaires, un contexte, pixels indépendants, fermeture d’un propriétaire et libération du dernier. Ce test valide le partage, pas un gain FPS des copies 2D. |
| F21 — Les réglages graphiques ne pilotent pas encore le moteur | Corrigé | Profils reliés aux FPS, résolution, effets, particules, voisines, filtres et budgets. Caches documentaires/recolorations ajustés immédiatement ; haute qualité linéaire, autres profils nearest, sans mipmaps. Pression mémoire : réduction puis restauration automatique sans écraser la préférence. Tests et parcours Electron validés. |
| F24 — Electron sonde les fichiers synchroniquement et met tout en cache immutable | Corrigé | Cache de chemins borné à durée courte, lecture/décompression par flux et politique immutable réservée aux noms hashés. Les premiers accès utilisent encore des sondes synchrones. |
| F25 — Les métriques et tests de performance peuvent annoncer un faux succès | Corrigé | Mesures après préchauffage séparant CPU, GPU, intervalles entre rendus, dessins, uploads et mémoire ; étapes/relevés sauvegardés avant assertions et attentes. Seuils réels par corpus, 30 transitions navigateur et Electron, zoom effectivement constaté, endurance Electron de 10,2 minutes/124 relevés réussie. La soumission de rendu reste distincte de la présentation physique ; le jeu complet sur macOS relève de F36. |

## Atlas, pipeline et contrats visuels

| Point | État | Modification et limite |
|---|---|---|
| F13 — Les atlas ne couvrent pas uniformément le monde | Partiel | Préparation mondiale des atlas par lots avec checkpoints, intégrée au pipeline. Essai isolé de quatre cartes ; les 17 353 cartes ne sont pas régénérées ni publiées. |
| F20 — Des effets déclarés supportés ne sont pas appliqués visuellement | Partiel | Cinq familles sans rendu correctement déclarées render_absent. Les vagues, post-traitements et séquences manquants ne sont pas implémentés. |
| F32 — Une extraction après mise à jour peut garder les anciens pixels | Corrigé | PNG réécrit atomiquement après modification du bundle ; signature des maps liée aux métadonnées gfx. |
| F33 — Les rapports de publication ne prouvent pas la couverture visuelle actuelle | Partiel | Vérification exécutée sur les 17 353 cartes installées : 3 591 références de dépendances absentes, aucune version d’effets inconnue. Vérificateur utilisable sans UnityPy ; échecs correctement signalés. Publication mondiale et rapport de release complet restent en attente de réparation des données. |
| F36 — La base de validation doit couvrir le jeu réel et les ressources réelles | Partiel | 639 tests client, 90 serveur, 115 Python ; WebGL 1×/2× et Electron multi-cartes/profils réussis. Session réelle sur copies temporaires : Auth → World, sélection personnage, HUD/catalogue, map, entrée et demande de sortie de combat. Les copies sont supprimées. Combat complet et endurance de jeu sur macOS restent à valider (Windows exclu à la demande de l’utilisateur). |

## Code mort et structure

| Point | État | Modification et limite |
|---|---|---|
| F34 — Le code mort et les doublons doivent être séparés des outils de test | Corrigé | Dix modules de production inatteignables supprimés ; ParticleEvents déplacé dans testSupport, tests conservés. |
| F35 — La structure du code complique les optimisations sûres | Partiel | Écrans chargés à la demande avec Suspense. TypeScript strict activé et validé sur tout le client. Découpage des classes centrales, couverture CSS et clarification du manifeste racine restants. |

## Artefacts et reprise

- Rapport initial : [AUDIT-CODE-PERFORMANCE-2026-09-08.md](AUDIT-CODE-PERFORMANCE-2026-09-08.md). Ses constats et lignes décrivent l’état avant correction.
- Journaux, résultat Electron et vérification des atlas : [.local/audit-fixes-tests](../.local/audit-fixes-tests/).
- Copies des fichiers avant modification : [.local/audit-fixes-baseline](../.local/audit-fixes-baseline/).
- Atlas d’essai isolés : [.local/audit-atlas-check](../.local/audit-atlas-check/).

La réfraction et la session isolée avec entrée en combat sont maintenant vérifiées. Les prochaines étapes sont la réparation des dépendances absentes, la réduction des ressources épinglées et la préparation/publication mondiale des atlas. La refonte GPU du vent reste à réaliser ; le renderer partagé des portraits est terminé ; la refonte du SQL courant est maintenant validée en tests, à activer et mesurer sur World.

## Correctif après signalement du timeout de sélection

La nouvelle file d’envoi révélait une régression dans Auth : `SelectServer` mettait la réponse 4944 en file puis appelait immédiatement `Disconnect`, qui supprimait les messages en attente. Ajout d’une fermeture après vidage de la file, refus de nouveaux envois pendant cette fermeture et délai maximal de cinq secondes ; fermeture TCP explicite avant destruction de la socket. Les réponses de refus d’identification suivent également ce chemin.

Validation : 13 tests réseau réussis, dont envois partiels bloqués et réponse SelectedServerDataMessage reçue intégralement sur une vraie socket avant EOF. Build Auth Release réussi. Journaux : `.local/audit-fixes-tests/auth-close-tests.log` et `auth-close-build.log`.

**Activation vérifiée après autorisation :** une nouvelle instance Auth est active ; le parcours réel reçoit SelectedServerDataMessage (4944), rejoint World et obtient la liste des personnages. Preuve : `.local/audit-fixes-tests/auth-close-smoke.log`. Le serveur World et MariaDB n’ont pas été arrêtés par cette intervention.

## Deuxième passe — SQL et chargements

- **F26/F28 :** pool par opération, lots atomiques et index des objets par propriétaire. Validation des erreurs en deuxième lot, du rollback métier existant et de l’absence de blocage entre connexions indépendantes. Les modules Pokéfus, GuildCamp et Quests compilent. Les garanties métier de leurs verrous ne sont pas remplacées par le pool SQL.
- **F05/F12 :** priorités de clips et documents, annulation partagée et LRU sans tri. Tests du dernier utilisateur, de la promotion d’un clip en attente et de l’éviction après réacquisition.
- **Validation finale :** 90 tests serveur, 638 tests client, TypeScript/build production et build benchmark réussis ; Electron multi-cartes réussi en 18 secondes, sans erreur JavaScript. Les vérifications Python/atlas de la première passe n’ont pas été réexécutées, leurs sources étant inchangées dans cette passe.
- **Activation :** correctif de connexion Auth vérifié sur l’instance locale. Les nouveaux changements SQL/index de cette deuxième passe sont validés en compilation/tests ; ils ne sont pas chargés dans le processus World déjà lancé. Leur activation nécessite son prochain redémarrage maîtrisé. Aucun déploiement mondial d’assets effectué.

Artefacts : `.local/audit-fixes-tests/sql-pool-tests.log`, `sql-module-builds.log`, `continuation-vitest.log`, `continuation-build.log`, `continuation-benchmark-build.log`, `continuation-electron.log` et `continuation-electron-runtime.json`.

## Troisième passe — rendu, profils et validation complète des dépendances

### Corrections et résultats

- Le mode économique libère immédiatement les voisines au lieu de les masquer. Sur le corpus Electron : **552 → 194 textures épinglées**, pool **212 → 179,8 Mio** après libération des ressources libres. Le retour au profil équilibré recharge les quatre voisines. Cela ne constitue toujours pas un plafond de 128 Mio : les ressources utilisées par la map centrale restent protégées.
- Réfraction : pixels comparés à 1×/2×, masque et déplacement vérifiés ; aucun rendu de capture quand les passes sont hors écran ou désactivées. Les avertissements Pixi de destruction de textures encore liées apparaissent toujours lors du nettoyage du fixture WebGL ; ce point de cycle de vie mérite une investigation séparée, les assertions de pixels passent.
- Combat : rendu conditionné aux changements et transitions pilotées par le tick. Test des périodes immobiles, de la progression, de l’annulation et de la destruction.
- Parcours serveur isolé complet réussi jusqu’à un combat contre une Larve Bleue : HUD et catalogue vérifiés, map 153880835 reçue. Un `Broken pipe` est journalisé lorsque le client de smoke test ferme sa socket après sa demande de sortie ; le test ne valide pas une longue séquence de tours. Les deux serveurs de test ont été arrêtés et leurs bases `giny_orm_test_*` supprimées. World actif n’a pas été redémarré.
- Tests actuels : **639 client (1 ignoré), 90 serveur, 115 Python (5 ignorés)**. Build production et benchmark réussis. Les tests serveur sont ceux de la deuxième passe, complétés par le nouveau parcours réel ; aucune source serveur modifiée pendant cette troisième passe.

### Résultat du contrôle mondial

Le contrôle a effectivement lu **17 353 maps**. Il échoue avec **3 591 références vers des dépendances absentes** du pack installé ; ce nombre compte des références, pas nécessairement des fichiers uniques. Exemples : `gfx/15363.png`, `effects/masks/816.png`, `effects/particles/2217.png`. Aucune version d’effets inconnue n’a été détectée. La couverture visuelle mondiale et la publication des atlas ne peuvent donc pas être déclarées validées.

Le suivi conserve explicitement les autres travaux non terminés : vent GPU, effets visuels absents, catalogues chargés par fenêtre, renderer partagé des portraits, harmonisation complète des loaders et refonte des grandes classes. Cette passe ne les transforme pas en corrections terminées.

### Artefacts

`.local/audit-fixes-tests/finish-vitest.log`, `finish-pytest.log`, `finish-build.log`, `finish-benchmark-build.log`, `finish-electron.log`, `refraction-pixels.log`, `full-world-effects-validation.json`, `session-smoke.log`, `session-validation.log` et `session-validation.py`.

## Quatrième passe — derniers points partiels, état réel

### Points terminés

- **F12 :** propagation des annulations jusqu’aux lectures réseau des loaders legacy, des portraits et du combat. Suppression de la promesse permanente des clips de combat au profit du cache à propriétaires. L’annulation ne déclenche pas de fallback ni d’extraction supplémentaire.
- **F14 :** catalogue par groupes de fenêtres et partage des JSON décodés. Les tables nécessaires au HUD restent initiales ; six tables sont différées. Les requêtes réussies sont conservées lorsqu’une autre échoue.
- **F18 :** renderer partagé des portraits, cycle de vie à références et isolation d’une animation qui échoue. Les miniatures gardent leur budget de 16 Mio ; le dernier propriétaire détruit le contexte partagé.

### Prolongements réalisés

- **F21 :** réduction immédiate des particules actives et buffers de matériaux au changement de profil ; restauration sans recharger la map. Les systèmes plus nombreux que le budget peuvent désormais recevoir une capacité nulle plutôt que dépasser le budget avec un minimum de une particule chacun.
- **F08 :** suppression des tableaux temporaires de coins alloués pour chaque particule à chaque mise à jour du batch. Le pooling complet et les états offline ne sont pas terminés.
- **F25/F10 :** queries GPU bornées à quatre en attente, échantillonnage tous les quinze rendus, résultats lus sans attente bloquante. Sur ce parcours : moyennes cumulées du rendu final de **5,20 à 6,72 ms**, hors captures de réfraction. Mémoire résidente du processus de rendu observée entre **587 et 835 Mio** aux points de contrôle ; ce n’est ni la consommation de toute l’application, ni la VRAM. Les processus Browser/GPU/Utility sont également consignés dans le JSON.
- **F35 :** `strict: true` activé dans `tsconfig.app.json`, sans contournement global ni changement de niveau ECMAScript.
- **F33 :** inventaire exhaustif des dépendances absentes : **815 fichiers uniques**, répartis en 639 mapgfx, 59 emissives, 55 particles, 49 masks et 13 noises. Aucun fichier récupérable directement dans le cache source mondial et les catalogues gfx/effets vérifiés. Ce résultat ne prouve pas leur absence de tous les bundles Unity ; une investigation/réextraction des sources reste nécessaire. Suppression d’une sérialisation JSON redondante pendant la vérification.

### Validation et travail restant

**645 tests client réussis, 1 ignoré ; 115 tests Python réussis, 5 ignorés.** Build production strict et benchmark validés. Parcours Electron multi-cartes/profils réussi (14,8 s) ; trois tests de pixels WebGL réussis (portraits, atlas/réfraction aux résolutions 1 et 2). La capture Electron finale a été inspectée. Les avertissements Pixi du nettoyage de réfraction restent présents. Les sources serveur n’ont pas changé pendant cette passe ; aucun redémarrage de World.

**L’ensemble des points partiels n’est toujours pas terminé.** Restent : versions métier/push HUD (F31), priorité complète du chemin legacy/extraction (F05), invalidation par révision et retry explicite (F22), vent GPU (F07), pooling/préchauffage offline (F08), pression mémoire adaptative (F10/F21), atlas mondiaux (F13), familles visuelles absentes (F20), réparation/publication des assets (F33), endurance/Windows (F25/F36), découpage des grandes classes/CSS/manifeste racine (F35). Ces travaux ne sont pas assimilés à une validation réussie.

Artefacts : `.local/audit-fixes-tests/partials-vitest.log`, `partials-build.log`, `partials-benchmark-build.log`, `partials-electron.log`, `partials-electron-runtime.json`, `partials-map-final.png`, `partials-webgl.log`, `partials-pytest.log`, `partials-world-dependencies.json`.

## Reprise exhaustive — F31 en cours

Ajout d’un cache de construction du snapshot HUD par connexion/personnage et révision. Les réponses périodiques inchangées n’appellent plus le constructeur JSON tant que les notifications serveur n’ont pas invalidé la révision. Les envois explicites après mutation restent forcés. Une reconstruction de secours après 30 secondes conserve la réconciliation des anciens chemins sans notification. Les réponses de projection ne s’auto-invalident pas.

Deux tests ciblés réussis : absence de reconstruction au repos, invalidation par révision, envoi forcé, changement de propriétaire, expiration et nouvel essai après exception. F31 reste ouvert jusqu’à vérification des pushes manquants et des parcours équipement/combat/portes/reconnexion ; le polling n’a pas encore été espacé. Preuves : `f31-cache-tests.log` et `f31-server-tests.log` dans `.local/audit-fixes-tests`.

### F31 — notifications et parcours réseau

Les notifications legacy d’inventaire, équipement, quantités, kamas, statistiques, sorts, raccourcis, métiers et succès déclenchent une demande HUD groupée à 100 ms. Une notification pendant une requête conserve un nouveau passage ; une déconnexion annule les demandes différées de l’ancienne connexion. Deux tests dédiés réussis ; suite client **647 réussis, 1 ignoré**, build strict réussi. Suite serveur complète **92 réussis**, SQL isolé inclus.

Parcours réseau sur copies temporaires réussi avec la nouvelle implémentation : connexion, personnage, carte, **deux réponses HUD légères au repos**, puis entrée en combat. Preuves : `f31-session-validation.log`, `session-smoke.log`, `f31-client-tests.log`, `f31-client-build.log`. Le polling reste à 2 s/4 s jusqu’à validation complémentaire des changements d’équipement, portes et reconnexion ; F31 n’est pas clos par ce seul parcours.

### F31 — équipement réel validé

Le scénario isolé ajoute un équipement de niveau 1 issu de la base copiée, le déplace vers son emplacement puis le restaure. Chaque position est confirmée dans un **push HUD reçu avant la réponse de commande**, sans attendre le polling. La réconciliation inchangée et l’entrée en combat restent validées dans le même parcours. Le test cible le GID ajouté : une première version choisissait un consommable dont le slot est réservé par Pokéfus et échouait légitimement. Aucun contournement des règles d’équipement n’a été ajouté.

Un test supplémentaire de reconnexion vérifie qu’une ancienne requête encore en vol ne modifie pas la file de notifications de la nouvelle connexion. Suite client : **648 réussis, 1 ignoré**. Preuves : `f31-equipment-validation.log`, `f31-equipment-smoke.log`, `f31-client-tests.log`. Les portes et la reconnexion réseau complète restent à vérifier avant clôture de F31 et espacement du polling.

### F31 — reconnexion réseau validée

Deux connexions Auth/World successives au même personnage, dans la même base temporaire, réussissent. La première ajoute/équipe/restaure l’objet de fixture ; la seconde reçoit le HUD complet avec cet objet dans l’inventaire, valide les réponses inchangées puis entre en combat. Le script conserve maintenant les snapshots poussés pendant la sélection du personnage, au lieu de les jeter avant de lire une réponse de réconciliation légère. Cette correction renforce aussi les contrôles existants : un HUD complet est désormais exigé explicitement pendant la sélection.

Preuves : `f31-reconnect-validation.log`, `f31-reconnect-smoke.log`. La porte interactive reste à vérifier ; F31 demeure ouvert jusqu’à cette vérification et à l’espacement du polling de secours.

### F31 — clôture du défaut de réconciliation

Le parcours de porte temporaire, créé via la commande `.sun` sur un élément réel de la carte copiée, valide `InteractiveUseRequest`, `InteractiveUsed`, `CurrentMap`, le chargement de destination et le HUD de cette destination. La seconde connexion rejoint ensuite cette carte avec le même équipement restauré, puis entre en combat. Les serveurs isolés et leurs bases ont été supprimés.

Le client réagit désormais aux notifications d’apparition/disparition des acteurs. Les requêtes sont regroupées et le retour à la page visible déclenche une réconciliation. Le polling HUD et acteurs passe à **10 secondes** ; un test vérifie l’intervalle, les notifications, la suspension masquée et la reprise. **649 tests client passent, 1 ignoré** ; **92 tests serveur réussis** lors de cette correction. Le cache serveur utilise une révision de notifications conservatrice, pas un hash calculé en reconstruisant le snapshot. Le filet de secours de 30 secondes reste volontairement présent pour les chemins legacy silencieux.

F31 est corrigé pour le défaut décrit par l’audit. L’endurance de combat et la validation Windows restent dans F36. Preuves : `f31-portal-validation.log`, `f31-portal-smoke.log`, `f31-portal-reconnect-smoke.log`, `f31-final-client-tests.log`, `f31-final-client-build.log`, `f31-server-tests.log`. Prochain point : F05.

## F05 — propagation de priorité dans les caches imbriqués

Un utilisateur visible rejoignant un look partagé peut maintenant promouvoir son document enfant déjà en file. Si le manifeste est encore en attente, le contexte partagé conserve la priorité active pour la création ultérieure de la requête. `DocumentCache` propage les promotions aux utilisateurs enfants ; `TaskQueue` les applique même sans clé explicite et désabonne les tâches démarrées ou annulées. Les loaders de looks, props et documents préparés utilisent ce contexte partagé.

Deux tests couvrent la promotion avant et après la mise en file du document, avec un autre chargement background et un seul worker : le document visible passe devant sans être chargé deux fois. F05 reste ouvert pour la file legacy/extraction et le budget de préparation des instances. Artefacts : `f05-client-tests.log`, `f05-build.log`.

### F05 — files legacy et extraction native

Les documents legacy d’entités et de props partagent désormais une file de **quatre lectures/décodages maximum**, avec le contexte de priorité et le signal d’annulation. L’extraction passe par une file distincte à un travail actif. Une extraction native démarrée conserve son emplacement jusqu’à la fin réelle du job, même si son appelant annule son attente ; les demandes visibles précèdent les extractions background encore en attente.

Test spécifique réussi : annulation du premier utilisateur pendant un job natif, absence de deuxième job concurrent, puis passage visible avant background. Suite client **652 réussis, 1 ignoré**, build strict réussi. Artefacts : `f05-legacy-tests.log`, `f05-legacy-build.log`. Le budget temporel de préparation des instances et le parcours HTTP d’extraction restent à terminer avant clôture de F05.

### F05 — budget de préparation et extraction HTTP

Le chemin HTTP conserve maintenant, comme le natif, son emplacement d’extraction jusqu’à la réponse réelle : fermer le fetch ne terminait pas le processus côté Vite. L’appelant peut toujours annuler immédiatement son attente. Le test de sérialisation/priorité est exécuté pour les deux transports.

Ajout d’un budget coopératif partagé entre acteurs, portraits et props : checkpoints de **3 ms en actif / 1 ms en arrière-plan**, avec attente annulable et yield commun aux préparations concurrentes. Les checkpoints encadrent la préparation initiale des poses et les recolorations de textures. Ce sont des tranches coopératives, pas un plafond sur une opération JavaScript indivisible. Les documents distincts des props voisins sont chargés avec trois workers au maximum ; les instances restent préparées sous ce budget.

**655 tests client réussis, 1 ignoré** ; build strict et benchmark réussis ; Electron multi-cartes/profils réussi en 15,2 s. Artefacts : `f05-budget-tests.log`, `f05-budget-build.log`, `f05-benchmark-build.log`, `f05-electron.log`, `f05-electron-runtime.json`. La dernière vérification du chemin révèle que les uploads GPU reçoivent encore seulement le signal, pas la priorité : ce dernier maillon doit être corrigé avant clôture de F05.

### F05 — clôture de la chaîne de priorité

Les uploads GPU utilisent une file commune prioritaire et le budget de préparation ; les maps transmettent leur contexte complet, les entités leur priorité active/background. Test : un upload visible passe devant une voisine en attente ; un upload annulé n’atteint pas `initSource`.

**656 tests client réussis, 1 ignoré**, build strict/benchmark réussi ; parcours Electron multi-cartes et changements de profil réussi en 7,2 s, sans erreur JavaScript. Capture finale inspectée. Cette durée isolée ne prouve pas un gain avant/après, notamment à cause des caches. Les opérations individuelles de décodage ou d’upload restent indivisibles ; le budget est coopératif entre opérations.

F05 est corrigé. Preuves : `f05-final-tests.log`, `f05-final-build.log`, `f05-final-electron.log`, `f05-final-runtime.json`, `f05-final-map.png`. Prochain point : F22.

## F22 — manifestes réessayables

Les manifestes des maps et des entités utilisent une ressource partagée avec revalidation après 30 secondes à la prochaine lecture, délai après erreur de 5 à 30 secondes, et invalidation explicite. Il n’y a pas de timer de polling supplémentaire. Les erreurs réseau/format restent réessayables ; une réponse provenant d’une ancienne lecture invalidée ne remplace plus la nouvelle entrée. Un appelant déjà annulé ne lance pas de lecture.

Les tests couvrent coalescence, expiration, délai après erreur, réponse ancienne et annulation préalable. F22 reste ouvert : il faut relier l’invalidation des caches de documents aux révisions, harmoniser les styles et proposer le retry explicite dans l’interface de chargement. Artefacts : `f22-manifest-tests.log`, `f22-manifest-build.log`.

### F22 — styles réparés et révisions des cartes

Les styles reconstruisent désormais leur état à partir des règles reçues et des seules surcharges explicites du client. Une règle supprimée disparaît, une règle modifiée remplace sa précédente valeur et une réponse ancienne ne peut pas écraser celle d’un retry plus récent. Deux tests couvrent ces cas et la reprise après HTTP 503.

Le chargement d’une carte consulte le manifeste réessayable avant le cache documentaire. L’identité du document comprend la révision, le hash et le chemin publiés : une nouvelle publication est donc visible à la prochaine consultation après expiration du manifeste, sans interrompre les utilisateurs de l’ancien document. Les appels simultanés restent regroupés. Un test vérifie la réutilisation à révision identique puis le nouveau téléchargement après réparation.

Validation : **662 tests client réussis, 1 ignoré**, build de production strict réussi (`f22-map-tests.log`, `f22-map-build.log`). F22 reste partiel : commande de retry dans l’interface et cohérence des caches supérieurs d’entités encore à terminer. Les autres points partiels du tableau ne sont pas clos par ces vérifications.


### F22 — clôture de la reprise des chargements

Le bouton « Réessayer le chargement » apparaît sur les erreurs de chargement de carte (documents, textures ou personnage), séparément des erreurs de mouvement. Il invalide les manifestes, réessaie les styles et reconstruit la destination en erreur. Une nouvelle destination annule le retry précédent ; les erreurs de ce travail annulé ne réaffichent pas le bandeau. Les looks et fallback props utilisent une identité de publication, de sorte qu’un ancien fallback ne masque plus les entités réparées. Les objets de manifeste obsolètes ne remplacent pas l’identité courante.

**666 tests client réussis, 1 ignoré**, build de production strict réussi. Deux tests de transition couvrent la reprise immédiate et son annulation ; deux tests d’entités couvrent un look déjà en cache puis republié et une réponse de manifeste obsolète. Parcours Playwright dans le navigateur : interception HTTP 503 d’une carte préparée, suppression de l’interception, clic sur le bouton, carte affichée avec **1 828 sprites** sans navigation/rechargement et bandeau disparu. Capture inspectée : `output/playwright/f22-retry.png`. Logs : `.local/audit-fixes-tests/f22-retry-tests.log` et `f22-retry-build.log`.

F22 est corrigé pour le défaut de reprise décrit par l’audit. Prochain point : F07, déformation du vent sur le GPU.


## F07 — vent GPU et préservation des lots de dessin

Le calcul des paramètres animés est ramené à huit coefficients par objet/image. Les poids de flexion sont calculés une fois au chargement. Les maillages de plus de 100 sommets appliquent ces coefficients dans un vertex shader, sans réécriture ni upload du buffer de positions. Les petits maillages utilisent actuellement les mêmes coefficients précomposés dans les lots standards de Pixi.

La première version GPU universelle a été mesurée puis corrigée : un shader par petit objet cassait le regroupement Pixi et portait les dessins de la carte 154644 de 109 à 757. La version conservée respecte le seuil réel de Pixi et retrouve **109 / 496 / 444 dessins** sur les trois cartes, contre **109 / 497 / 444** dans le parcours de référence. Cette mesure ne prouve pas un gain FPS universel ; les durées GPU varient entre exécutions et incluent le préchauffage.

Validation : **667 tests client réussis, 1 ignoré**, build benchmark strict réussi ; **24 comparaisons WebGL** (12 petits maillages regroupés, 12 grands maillages GPU) sans canal différent de plus de 2/255, aucun échantillon vide, aucune exception du navigateur ; parcours Electron multi-cartes/profils réussi en 8,2 s. Artefacts : `f07-hybrid-tests.log`, `f07-hybrid-build.log`, `f07-hybrid-pixels.log`, `f07-hybrid-electron.log`, `f07-hybrid-runtime.json`, `f07-hybrid-map.png` dans `.local/audit-fixes-tests`.

F07 reste partiel : le regroupement GPU des petits maillages reste à terminer. Le seuil actuel évite une régression de dessins pendant ce chantier ; il ne clôt pas l’objectif de portage complet.


### F07 — clôture du portage GPU complet

Le lot de rendu du monde accepte désormais les sprites ordinaires et les maillages déformés ensemble. Les sommets portent seulement l’identité de leur objet et un poids de flexion statique ; le vertex shader lit deux texels RGBA32F contenant les coefficients de transformation. Le CPU ne parcourt ni ne réécrit les sommets pour animer le vent, y compris sur les petits maillages. Les pivots, rotations, échelles, couleurs, UV d’atlas et ordre de dessin restent conservés. Le premier shader individuel et le chemin CPU intermédiaire ont été retirés du code de production.

Le branchement est propre au renderer du monde. Les emplacements de palette sont récupérés à la destruction des maillages, réutilisés, et les listeners détachés à la destruction d’un renderer sans affecter un autre contexte. La palette grandit avec la scène jusqu’à un plafond de 2 Mio ; le parcours réel utilise **32 Kio** de coefficients, avec **537 → 244 → 537 objets** lors du passage normal → économique → normal. Les capacités des buffers de lots, visibles dans `windBuffers`, restent réutilisables après ce changement ; elles ne représentent pas la VRAM réelle du processus.

Validation : **670 tests client réussis, 1 ignoré**, builds de production et benchmark stricts réussis. **24 comparaisons WebGL sans écart supérieur à 2/255 et sans échantillon vide**. Test d’animation en place : 31 308 canaux changés, décalage caméra de 20 pixels exact, **zéro mise à jour du buffer de positions**, palette vide après destruction. Parcours Electron multi-cartes/profils réussi avec assertions de libération des emplacements ; dessins **105 / 457 / 407** (la carte animée a aussi produit 451 lors du passage précédent), contre **109 / 497 / 444** dans le parcours de référence. Ces mesures ne sont pas extrapolées à un gain FPS universel ou à Windows.

Preuves : `.local/audit-fixes-tests/f07-batch-tests-final.log`, `f07-batch-build.log`, `f07-batch-production-build.log`, `f07-batch-pixels.log`, `f07-batch-animation.log`, `f07-batch-electron-final.log`, `f07-batch-runtime-final.json`, `f07-batch-map-final.png` (capture inspectée). F07 est corrigé. Prochain point : F08, allocations et budget des particules.


## F08 — recyclage et budget de préchauffage commun

Les émetteurs recyclent les enregistrements complets des particules, leurs sprites et leurs traînées. Les sous-émetteurs retiennent leur parent jusqu’à la fin de leur émission : une particule morte encore suivie reste stable et ne peut pas devenir une nouvelle particule. Les références sont libérées à l’expiration, à la réduction de qualité et à la destruction. Les triggers sont réutilisés ; les points de traînée utilisent un tampon circulaire au lieu d’objets créés puis décalés à chaque point. Les capacités inutilisées du pool sont réduites avec le profil graphique.

Les formes, vecteurs, positions précédentes et couleurs du chemin courant utilisent des espaces de travail par émetteur. Le calcul des couleurs conserve les valeurs de **20 échantillons capturés avant modification**, couvrant les cinq modes et les gradients d’alpha. Les chemins exceptionnels de collision restent à revoir ; il ne s’agit pas d’une garantie d’absence de toute allocation JavaScript.

Le renderer partage désormais un seul budget de préchauffage entre la carte centrale et les voisines : **8 pas / 1 ms par image**, ou **4 pas / 0,5 ms** en mode économique. Le coût est mesuré autour des pas exécutés, sans imputer les autres tâches du renderer. Le budget est coopératif : un pas indivisible peut franchir sa limite temporelle, puis aucun autre pas ne démarre. La rotation entre émetteurs préserve leur progression ; la carte centrale garde la priorité sur les voisines. Aucun timer supplémentaire n’est ajouté.

Validation : **679 tests client réussis, 1 ignoré**, builds stricts de production et benchmark réussis. Tests de réutilisation stable sur 600 ticks supplémentaires, conservation d’un parent mort suivi par un enfant retardé, expiration/réutilisation des traînées, libération des pools, partage du budget et absence de famine entre émetteurs. Parcours Electron multi-cartes/profils réussi en **8,9 s** ; les compteurs `particles.pooled` montrent les réutilisations sur les cartes réelles, et `particlePrewarm` expose le budget de la scène complète. Artefacts : `.local/audit-fixes-tests/f08-final-tests.log`, `f08-final-build.log`, `f08-final-production-build.log`, `f08-final-electron.log`, `f08-final-runtime.json`, `f08-final-map.png`.

F08 reste partiel : états de départ précalculés et derniers chemins d’allocation à traiter avant clôture.


### F08 — contacts de collision réinitialisés au recyclage

La dernière revue du chemin de collision a révélé qu’un objet particule réutilisé pouvait garder son ancien contact dans le WeakMap du monde de collision. Chaque naissance réinitialise maintenant ce contact. Le résultat de collision et le vecteur de rebond utilisent aussi des espaces de travail réutilisables. Un test vérifie le contact unique pendant une vie, sa réactivation après recyclage, et le rebond en place.

**680 tests client réussis, 1 ignoré**, build de production strict réussi. Le parcours Electron précédent reste la validation des cartes installées, qui ne contiennent pas de module de collision ; le chemin ajouté est validé par le test ciblé. Preuves : `f08-final-tests.log` et `f08-final-production-build.log`. F08 reste ouvert pour les états de départ précalculés.

### F08 — états de départ préparés et chargement coopératif

Le générateur `prepare-particle-starts.mjs` calcule les états de départ hors ligne pour les trois profils graphiques, au centre et en voisinage. Les états conservent les graines, horloges, particules, traînées et liens vers les parents morts encore suivis. Chaque état est lié à l’empreinte des paramètres sources ; les données absentes, périmées ou invalides retombent sur le préchauffage distribué. Le manifeste optionnel utilise le mécanisme de rafraîchissement et le cache borné existants. Les états sont intégrés au pipeline de construction et à la fermeture des dépendances de publication.

La restauration cède le thread avec le budget de préparation commun. Pendant cette opération, les ticks et changements de capacité attendent sa fin ; une destruction intercalée libère l’état partiel. Les tests comparent exactement 90 ticks après sérialisation/restauration, y compris les parents retenus et les traînées. **684 tests client réussis, 1 ignoré**, builds production et benchmark réussis. Le parcours Electron avec données préparées isolées passe en **7,8 s** : quatre visites de trois cartes réelles, retour sur la première, profils économique puis équilibré ; chaque visite confirme `particles.preparedStart=true`, sans erreur JavaScript. Preuves : `f08-restore-guard-tests.log`, `f08-restore-guard-build.log`, `f08-precomputed-electron.log`, `f08-precomputed-runtime.json`, `f08-precomputed-map.png` dans `.local/audit-fixes-tests`.

La génération complète des 17 353 cartes est en cours dans `.local/audit-particle-start-check`, avec reprise tous les 32 documents. F08 reste ouvert jusqu’à la vérification de cette génération et de la reprise ; aucune donnée installée n’a été remplacée.

Les contrôles complémentaires du chargeur F08 passent : absence de manifeste optionnel sans requête supplémentaire, empreinte périmée rejetée avant téléchargement, rechargement réussi après erreur et invalidation, annulation conservée. Reprise du générateur vérifiée sur trois cartes : zéro recalcul au second passage ; modification d’une source : recalcul effectif. Logs `f08-loader-tests.log`, `f08-loader-build.log`, `f08-resume-first.log`, `f08-resume-second.log`, `f08-resume-changed.log`.

### F10 — distinction des allocations encore détenues

Le pool expose les octets des sources épinglées, des sources inutilisées et des sources dont la destruction asynchrone n’est pas encore terminée. `accountedBytes` conserve ces dernières jusqu’à leur libération effective par le mécanisme de destruction. Ces chiffres restent ceux fournis par l’estimateur des sources ; ils ne mesurent pas la mémoire résidente de l’application ou la VRAM réelle. Le cache des états de particules apparaît aussi dans le diagnostic du renderer. Test de destruction retardée réussi ; **689 tests client réussis, 1 ignoré**, build strict réussi (`f10-accounting-tests.log`, `f10-accounting-build.log`). F10 reste ouvert pour les limites et l’adaptation à la pression mémoire.

### Clôture F08 — préparation mondiale et activation locale vérifiées

**17 353 cartes traitées ; 14 137 nécessitent un préchauffage, soit 84 822 variantes de départ.** Le contrôle exhaustif vérifie les empreintes des fichiers, identifiants de carte, profils, références entre particules et absence de pas de préchauffage restant. Volume : 920 257 383 octets compressés, 2 396 339 694 octets JSON. Le second passage complet réutilise les **17 353 cartes avec zéro recalcul**. Une source modifiée avait également été vérifiée : elle provoque bien le recalcul.

Les états sont désormais installés dans `client/web/game-data/optimized/particle-starts`. Le manifeste principal ne les annonce qu’après installation des dépendances ; son ancienne version est sauvegardée dans `.local/audit-fixes-baseline`. Le parcours Electron utilisant les données installées confirme `preparedStart=true` lors des quatre visites et passe en **7,5 s**, avec changement de profils et aucune erreur JavaScript. Les clients sans états préparés gardent le préchauffage réparti entre images. La publication complète des autres assets reste traitée séparément dans F13/F33.

Validation finale : **689 tests client réussis, 1 ignoré**, builds production et benchmark réussis. Artefacts dans `.local/audit-fixes-tests` : `f08-full-starts.log`, `f08-full-starts-verified.log`, `f08-full-starts-resumed.log`, `f08-installed-starts.log`, `f08-installed-electron.log`, `f08-installed-runtime.json`, `f08-installed-map.png`, `f08-f10-final-tests.log`, `f08-f10-final-build.log`. **F08 est corrigé.** F10/F21 restent les prochains points ouverts ; le premier correctif de comptabilisation mémoire ci-dessus est déjà appliqué.

### F10/F21 — adaptation mémoire et admission des textures

Le renderer échantillonne une fois par seconde les sources épinglées. Au dépassement du budget du profil, il annule/libère les voisines et plafonne la résolution du monde à 0,75. Le profil utilisateur n’est pas modifié. Le retour attend au moins 30 secondes de réduction et 10 secondes continues sous 80 % du budget. Le premier seuil essayé (60 %) empêchait la reprise sur la carte réelle conservant environ 180 Mio au centre ; il a été corrigé après échec du test Electron, puis le parcours complet a réussi.

Les sources partagées ont désormais un plafond d’admission de **768 Mio**. Les ressources inutilisées sont détruites avant refus ; les sources encore utilisées ne sont jamais évincées. Le contrôle et l’attente des destructions restent dans la file de chargement (six travaux au maximum), afin de ne pas accumuler une file illimitée de textures décodées. Les octets des sources décodées attendant leur admission sont exposés séparément. Ce plafond ne prétend pas borner toute la RAM de l’application : décodage en cours, copies dans plusieurs contextes, autres caches et allocations du pilote sont distincts. Un refus annule proprement le jeu de textures, libère les acquisitions déjà terminées ou tardives et remonte un message explicite dans le mécanisme de retry des cartes.

**Validation : 694 tests client réussis, 1 ignoré ; builds stricts production/benchmark réussis.** Tests du seuil, de l’hystérésis, du refus sans destruction des sources épinglées, de l’attente bornée et des acquisitions tardives. Parcours Electron réussi en **38,7 s** : 4 voisines → 0 → 4, résolution 1 → 0,75 → 1, profil équilibré conservé ; sources épinglées 222 337 012 → 188 536 932 → 222 337 012 octets. Preuves : `.local/audit-fixes-tests/f21-pressure-electron.log`, `f21-pressure-runtime.json`, `f21-pressure-map.png`, `f10-f21-final-tests.log`, `f10-f21-final-build.log`.

F10/F21 restent ouverts pour les autres catégories mémoire et les filtres mentionnés dans l’audit original. F25/F36 restent ouverts pour l’endurance étendue et Windows ; ce parcours n’en constitue pas la validation.

### Clôture F21 — filtres et budgets secondaires effectifs

Les caches documentaires nommés (cartes, documents et animations d’entités, props, looks, bases/skins de portraits, états de particules, animations/bindings de combat et arbres UI) sont recensés dans `documentCaches`. Leurs budgets valent 0,5× / 1× / 1,5× le budget équilibré selon le profil ; une réduction évince immédiatement les entrées LRU excédentaires. Ces valeurs restent des estimations de rétention des caches, pas une mesure des documents encore détenus par les scènes ni de toute la mémoire JS.

Les recolorations disposent de budgets **16/32/64 Mio** et d’un plafond d’admission de **128 Mio**, sans éviction des textures utilisées. Une recoloration refusée est détruite ; les ressources empruntées ne deviennent jamais la propriété du cache. Les textures inutilisées sont aussi libérées lors de la réduction des ressources périphériques. Une préparation d’entité qui échoue détruit désormais son propriétaire et libère les acquisitions partielles, y compris les recolorations déjà obtenues.

Le profil haute qualité applique le filtrage **linéaire** aux sources déjà chargées et aux nouvelles textures ; les profils économique et équilibré conservent **nearest**. Les mipmaps restent désactivées. Le canvas du monde change de résolution, sans réduire les textes HTML de l’interface. Le parcours Electron haute qualité → économique → équilibré réussit en **7,7 s**, confirme les samplers et les budgets réels : cartes 48 → 16 → 32 Mio ; recolorations 64 → 16 → 32 Mio. La capture haute qualité a été inspectée visuellement.

**698 tests client réussis, 1 ignoré ; builds production/benchmark réussis.** Artefacts `.local/audit-fixes-tests/f21-sampling-electron.log`, `f21-sampling-runtime.json`, `f21-sampling-high.png`, `f21-sampling-map.png`, `f21-secondary-final-tests.log`, `f21-secondary-final-build.log`. Avec la réduction/restauration mémoire validée dans la section précédente, **F21 est corrigé**. F10 reste ouvert pour les allocations par contexte GPU, les géométries et les documents détenus hors caches ; aucune mesure de VRAM totale n’est revendiquée.

### F10 — propriétaires des documents au-delà des caches

Les caches déclarent désormais leur rétention dans un registre par identité de document. La carte centrale, les voisines et les instances d’entités y déclarent également leur propriété ; une éviction LRU ne soustrait donc pas un document encore détenu par une scène. Un même objet partagé entre cache et scène n’est compté qu’une fois dans ce registre. Les instances d’entités utilisent leur propre document et actualisent l’estimation de leurs animations, y compris les clips ambiants épinglés, sans rescanner la géométrie à chaque changement de pose.

Ces chiffres restent des **estimations par document** : des structures imbriquées partagées entre documents distincts peuvent se recouper. Les sous-totaux par propriétaire se chevauchent intentionnellement. Ils ne doivent pas être additionnés au tas JS ou présentés comme sa mesure exacte. La destruction du renderer efface aussi ses références directes à la carte, la grille et les bords. La construction des voisines dispose d’un nettoyage global des erreurs, avec enregistrement immédiat de la destruction des particules/effets.

La validation a aussi révélé une course entre le changement manuel de profil et la temporisation mémoire : le mode économique pouvait déclencher la réduction juste avant un retour à Équilibré. Une demande explicite de profil offrant au moins 20 % de marge lève désormais immédiatement cette réduction ; la récupération automatique conserve son hystérésis. Le diagnostic reste consultable après destruction sans accéder à la caméra détruite.

**700 tests client réussis, 1 ignoré ; builds production et benchmark réussis.** Parcours Electron combinant changements de cartes/profils, pression mémoire automatique et destruction finale réussi en **38,8 s**. Avant destruction : 1 propriétaire de carte centrale, 4 de voisines et 4 d’entités. Après : aucun propriétaire `scene:*`, 45 documents conservés uniquement par les caches, zéro octet estimé hors caches. Le test unitaire vérifie séparément qu’un document évincé reste compté jusqu’à libération de son dernier propriétaire. Artefacts : `.local/audit-fixes-tests/f10-ownership-tests.log`, `f10-ownership-production-build.log`, `f10-ownership-benchmark-build.log`, `f10-ownership-electron.log`, `f10-ownership-runtime.json`, `f10-ownership-map.png`.

F10 reste ouvert : comptage des allocations de textures/buffers par contexte GPU à compléter, en conservant la distinction avec la VRAM réellement réservée par le pilote.

### Clôture F10 — allocations WebGL par contexte et catégories distinctes

Les canvas du monde et du renderer partagé des aperçus installent le suivi avant l’initialisation WebGL. Les demandes de stockage des buffers sont comptées avec remplacement, suppression et liaison réelle (y compris les index des VAO). Les textures couvrent allocations 2D/3D, images sources, stockage immuable, niveaux de mipmaps, cubes, tableaux, BC7 et autres formats connus ; les renderbuffers incluent les échantillons multiples. Les formats non déterminés restent signalés. Les compteurs sont remis à zéro à la perte du contexte et désinscrits à sa fermeture. Aucun parcours supplémentaire n’est ajouté aux draw calls ou aux mises à jour `bufferSubData` ; les requêtes de liaison interviennent aux allocations.

Ces tailles décrivent les **payloads de stockage demandés**, pas la VRAM réellement réservée : alignement/overhead du pilote et framebuffer par défaut restent exclus, avec dimensions du canvas exposées séparément. Une erreur GL sans exception peut aussi empêcher une allocation demandée ; ces compteurs ne remplacent pas les contrôles de rendu. Le tas JS est exposé séparément (`jsHeapMB`, null si indisponible) et les relevés mémoire des processus Electron sont conservés dans les résultats. Les compteurs de documents restent des estimations par objet/document avec les limites précisées plus haut.

Le parcours réel mesure, au retour au profil équilibré, **276 895 740 octets de textures et 4 404 472 octets de buffers** dans le contexte du monde, contre 222 337 012 octets de sources du pool : ces catégories ne sont donc plus confondues. Le tas JS observé à ce point vaut environ 211,1 Mio. Deux acquisitions simultanées d’aperçu partagent un seul contexte supplémentaire ; l’upload d’une source du monde y produit 9 210 244 octets de textures (source plus texture interne). La première libération conserve ce contexte, la dernière le supprime, sans modifier les octets de textures du monde. Après destruction du renderer : zéro contexte suivi et aucun propriétaire documentaire de scène.

Sous pression, les caches libèrent leurs documents prêts sans annuler les requêtes encore attendues ; les scènes qui les retiennent continuent d’être comptées. **706 tests client réussis, 1 ignoré ; builds production et benchmark réussis.** Parcours Electron combinant cartes, profils, copies GPU partagées, pression et destruction réussi en **38,9 s**, sans format d’allocation non mesuré ni erreur JavaScript. Artefacts `.local/audit-fixes-tests/f10-final-tests.log`, `f10-final-production-build.log`, `f10-final-build.log`, `f10-final-electron.log`, `f10-final-runtime.json`, `f10-final-map.png`. **F10 est corrigé.** Les seuils par corpus, uploads et endurance restent dans F25/F36 ; aucune validation de mémoire totale Windows n’est revendiquée.


### F25 — mesures après préchauffage et fuite de buffers corrigée

Les relevés de rendu utilisent une fenêtre dédiée après deux secondes de préchauffage. Les distributions CPU (tick et soumission de rendu), les intervalles entre rendus, les dessins et les queries GPU sont séparés. Les anciens percentiles du ticker restent explicitement identifiés. `presentedMs` désigne le retour de la première soumission de rendu, pas la présentation physique sur l’écran. Les transferts de buffers/textures sont comptés comme payloads demandés, séparément des allocations de stockage ; ils ne mesurent pas le trafic réel du pilote.

Les tests enregistrent les étapes avant les attentes et sauvegardent les relevés avant leurs assertions, y compris en cas d’échec. Le corpus contient quatre cartes, avec seuils de chargement, CPU/GPU, cadence, dessins, uploads et mémoire par catégorie/processus. Ces seuils locaux ne garantissent pas un FPS minimal sur tout PC.

Les transitions ont révélé des géométries détruites sans leurs buffers Pixi. Les maillages du décor, particules, entités et marqueurs de combat libèrent maintenant leurs buffers possédés. Sur **30 transitions complètes**, les relevés 6 et 30 présentent le même plateau : **223 buffers, 3 457 756 octets de buffers et 265 568 316 octets de sources**. Le parcours passe en 24,3 secondes. Le corpus Electron avec les seuils finaux passe en **27,2 secondes** ; le p95 CPU du tick est de 6,4 à 8,3 ms, et les payloads d’upload de 0,82 à 1,91 Mio par rendu selon la carte.

**711 tests client réussis, 1 ignoré ; build de production strict réussi.** Preuves : `.local/audit-fixes-tests/f25-final-tests.log`, `f25-final-build.log`, `f25-30-transitions.log`, `f25-30-transitions.json`, `f25-30-transitions.ndjson`, `f25-corpus-final.log`, `f25-corpus-final-runtime.json`, `f25-corpus-final-corpus.ndjson`. L’endurance de dix minutes est en cours ; F25 n’est pas encore clôturé.

### F13 — reprise vérifiée sur les sorties effectives

La reprise ne se contente plus d’un checkpoint et de la présence du manifeste. Elle vérifie l’identité/hash de chaque carte et l’empreinte des fichiers de carte et pages du lot, dont les variantes BC7. Une sortie absente, altérée ou tronquée empêche la réutilisation du lot ; une modification du générateur invalide également sa signature. Un lot incomplet ne reçoit pas de checkpoint de succès. Les tests couvrent une page modifiée/supprimée et une carte modifiée/tronquée/supprimée : **5 tests de publication réussis** (`f13-resume-tests.log`). La génération mondiale reste à effectuer.


### Clôture F25 — endurance, navigateur et réponse d’entrée vérifiés

L’essai Electron réussit en **10,2 minutes : 31 cycles complets des quatre cartes, 124 relevés valides, aucune erreur JavaScript ni dépassement des seuils**. Pour chaque carte, nombre et volume de buffers GPU restent strictement identiques sur les 31 passages. Maximum des p95 relevés : tick CPU 8,6 ms, soumission CPU 6,9 ms, intervalles entre rendus 26,8 ms, GPU 12,61 ms. Ce sont les maxima des percentiles de chaque fenêtre, pas des percentiles calculés sur toute la session. Maximum du working set par processus Electron : Browser 245,4 Mio, GPU 274,6 Mio, Utility 39,7 Mio, renderer 1 075,1 Mio ; les maxima ne sont pas nécessairement simultanés et ne doivent pas être additionnés.

Les **trois tests navigateur passent en 1,1 minute** : corpus de mesures, 30 changements de carte avec annulation du travail remplacé, atlas lossless et interaction. Le dernier test a ensuite été renforcé pour exiger le changement réel de la caméra et repasse en 4,3 secondes : échelle 1,0604 → 1,1876, réponse observée en moins de 71,9 ms. Ce délai inclut l’automatisation et son observation ; ce n’est pas une mesure du délai matériel d’entrée. Les métriques de chargement conservent la préparation centrale (acteurs/props inclus) et la première soumission séparément.

Le test du timer GPU vérifie la suppression des queries précédentes et l’exclusion du préchauffage. L’intervalle traversant la fin du préchauffage est également exclu des percentiles ; le corpus effectue déjà une remise à zéro après ce préchauffage. **712 tests client réussis, 1 ignoré ; build de production strict réussi.** Capture finale de l’endurance inspectée.

Preuves : `.local/audit-fixes-tests/f25-endurance-electron.log`, `f25-endurance-runtime.json`, `f25-endurance-corpus.ndjson`, `f25-endurance-summary.json`, `f25-endurance-map-final.png`, `f25-browser-final.log`, `f25-browser-artifacts/`, `f25-input-final.log`, `f25-input-response.json`, `f25-closed-tests.log`, `f25-closed-build.log`. **F25 est corrigé.** Ce corpus de rendu local ne remplace pas le parcours réseau/combat et la validation Windows de F36.


### F13/F33 — génération démarrée et inspection des sources

La génération des atlas mondiaux est lancée dans `client/dofus3/.cache/dofus3/world-atlases`, avec lots de 32, sorties immuables, reprise vérifiée et réserve de disque de 4 Gio. Le journal est `.local/audit-fixes-tests/f13-world-atlases.log`. Elle n’est pas terminée ; les données installées ne sont pas remplacées par ce chantier.

Inspection des **30 bundles de textures 1× et d’effets** du client installé : version **3.6.10.11**, identique à celle de l’inventaire exporté. Aucune des 815 identités qualifiées absentes n’a été retrouvée dans ce périmètre. Quatre correspondances numériques sont des **candidats non validés**, pas des réparations : `33` correspond à `effects/noises/33.png`, et `805898/805900/806057` à des textures de particules, alors que les références demandent `gfx/...`. Ces textures restent uniquement dans le dossier d’inspection ; aucune substitution par numéro n’a été installée. Les références de matériau et les éventuels autres bundles restent à examiner avant de conclure à une absence définitive.

Rapport qualifié : `.local/audit-source-recovery/report.json`. Le journal brut `f33-source-recovery.log` annonce quatre correspondances numériques ; la vérification des chemins du conteneur les a ensuite reclassées dans `numericCandidates`, avec `identityVerified=false` et les 815 références toujours non résolues.

### F20 — diagnostic fiable même avec un ancien document préparé

Une carte installée annonçait encore `wave_config`, `shader_wave` et `postprocess_config` comme supportés dans ses métadonnées préparées, malgré la correction de la table Python. L’adaptateur client applique désormais les limites effectives de ce build aux familles sans rendu. Il conserve les erreurs sources plus précises, ajoute le diagnostic de rendu absent et ne transforme jamais cette couverture en « complète ». Le vent déjà implémenté reste reconnu. Un test reproduit un ancien document annonçant les cinq familles comme supportées et vérifie leur statut réel.

**713 tests client réussis, 1 ignoré ; build de production strict réussi.** Preuves : `.local/audit-fixes-tests/f20-coverage-tests.log`, `f20-coverage-build.log`. Ce correctif rend le diagnostic honnête ; **il ne clôture pas F20**, qui exige encore les implémentations et leurs validations visuelles.


### Périmètre F36 confirmé — macOS uniquement

L’utilisateur confirme le 8 septembre : « Pas grave fais que MacOS j’ai pas de windows ». La validation Windows n’est donc plus un critère de clôture. F36 reste ouvert pour le parcours réseau/combat complet et l’endurance de jeu sur macOS ; l’endurance du corpus de rendu F25 est acquise séparément. Les mentions de Windows dans les anciennes passes restent historiques.

### F35 — points d’entrée Giny et manifeste de référence séparés

Le contenu JSON de l’ancien manifeste racine a été comparé au `package.json` de `resources/app.asar` : il est identique à celui de Bubble 0.1.328 (SHA-256 du fichier de l’archive : `4c9a5e2f44d61d59725cc3554f1332cd73df399b36c19d391943aa9c7a4df0ed`). Cette copie est conservée dans `docs/references/bubble-package.json`. Le manifeste racine est désormais `giny-workspace`, privé, sans dépendances dupliquées. Ses commandes dev/build/test/Electron/E2E/benchmark délèguent au manifeste existant de `client/web`. Le README précise installation et points d’entrée ; les scripts utilisant l’archive Bubble restent inchangés.

Validation de la liste des commandes et de la transmission effective de `npm test -- --help` à Vitest dans le client : `.local/audit-fixes-tests/f35-root-commands.log`, `f35-root-test-forwarding.log`. Aucune dépendance n’a été installée ou supprimée. F35 reste partiel pour le découpage des classes centrales et la couverture CSS.

### F13 — pages BC7 retenues hors atlas

Le premier lot de 32 cartes a calculé 70 pages en 494,37 secondes, puis le contrôle a correctement refusé son checkpoint : les sprites restés hors atlas conservaient des références vers des variantes BC7 déjà présentes dans le paquet source, mais absentes du nouveau dossier. Le générateur copie désormais ces dépendances conservées avant d’annoncer les cartes. Un test reproduit précisément une texture animée hors atlas avec sa variante BC7 et vérifie ses octets et sa référence ; **6 tests de publication réussis** (`f13-retained-pages-tests.log`).

Le premier processus est terminé en erreur (journal `f13-world-atlases.log`) ; après correction, la génération a été relancée et réutilise les pages immuables déjà calculées. Nouveau journal : `.local/audit-fixes-tests/f13-world-atlases-resumed.log`. Aucune publication mondiale n’est encore déclarée complète.


### F35 — découpage du chrome officiel et couverture CSS en cours

Le module `windowChrome.ts` de 1 226 lignes est séparé en lecture/propriétés et dimensions (`windowChrome.ts`), styles (`windowChromeStyles.ts`), construction des en-têtes (`windowHeaders.ts`) et encadrement des arbres (`windowFrame.ts`). Les consommateurs importent directement leur responsabilité ; aucun cycle entre ces modules n’est ajouté. La comparaison des déclarations avec la copie originale vérifie **79 déclarations, aucune manquante/ajoutée/modifiée**, hors imports et visibilité d’export (`f35-window-declarations.json`). **205 tests de l’interface officielle réussis ; build strict réussi** (`f35-window-split-tests.log`, `f35-window-split-build.log`).

Une collecte opt-in `E2E_CSS_COVERAGE=1` enregistre les plages de règles réellement utilisées pendant les parcours HUD/inventaire/personnages. `scripts/summarize-css-coverage.mjs` fusionne les plages par contenu de stylesheet et conserve les scénarios et leur état. Les tailles sont des unités UTF-16, pas les octets réseau ; une règle non observée n’est pas automatiquement du code mort.

La suite large de 60 parcours est encore en cours (`f35-css-browser.log`). Elle révèle des assertions antérieures au découpage, notamment anciens IDs d’inventaire, couleur de jauge désormais configurable, présence de raccourcis et anciennes valeurs de démonstration. Ces échecs restent à examiner ; aucune validation globale verte n’est annoncée. La preuve des 79 déclarations identiques permet de distinguer ce découpage des comportements préexistants.

Les deux tests d’inventaire sont corrigés à partir du DOM inspecté : bindings actuels, portée du composant d’équipement et recherche du même sprite lors du transfert. Le second vérifie maintenant l’aller-retour complet sac → équipement → sac. **Deux parcours réussis en 11,8 secondes** avec collecte CSS (`f35-inventory-retest.log`, dossier `f35-inventory-retest/`). Aucune modification des visuels ou de la logique d’équipement n’a été nécessaire. Le découpage des autres classes centrales, la compilation des adaptations stables et l’analyse finale du CSS restent ouverts.


### F35 — première suppression CSS prouvée

Le stylesheet historique `src/ui/bubble/styles/inventory.css` (477 lignes) n’avait plus aucun import, glob de chargement ni consommateur `.bubble-ui` dans le code/configuration Vite. Les deux parcours d’inventaire réussis confirment son absence parmi les styles chargés. Il est supprimé, avec copie conservée dans `.local/audit-fixes-baseline`. Cette suppression nettoie les sources ; **aucun gain de bundle ou de FPS n’est attribué à un fichier déjà non chargé** (`f35-dead-css.json`).

Le relevé intermédiaire de couverture couvre 30 scénarios et 43 contenus de stylesheet distincts : 1 022 041 unités UTF-16 dont 227 123 observées utilisées (`f35-css-in-progress.json`). La fusion retourne volontairement un échec tant que des scénarios échouent ; ces chiffres ne sont pas une preuve que le reste du CSS peut être supprimé. Le parcours large continue. Autre cause précise confirmée : les tests cosmétiques utilisent l’ancien identifiant `open=appearance`, alors que le registre actuel déclare `cosmetics` ; leur correction/validation reste à faire.


### F35 — réponses réseau isolées et résultat des parcours CSS

`FrameReplies.ts` isole de `GinyClient` la consommation des réponses, les attentes par identifiant, leurs délais et leur rejet à la fermeture. La publication du HUD précède toujours la résolution de la réponse. Quatre tests couvrent l’ordre des réponses, la consommation unique, le timeout exact et le nettoyage des délais à la déconnexion. **80 tests réseau réussis et build strict réussi** (`f35-replies-tests.log`, `f35-replies-build.log`). Ce découpage ne clôt pas à lui seul F35.

La collecte large est terminée : **36 parcours réussis, 24 en échec sur 60**, en 14,3 minutes (`f35-css-browser.log`). Les deux parcours d’inventaire ont déjà été corrigés et revalidés séparément. Les anciens identifiants de fenêtre cosmétiques et les attentes de couleur/raccourci sont corrigés selon le registre et les préférences actuels ; leur revalidation reste en cours. Aucun résultat global vert ni suppression massive de CSS n’est annoncé.

F36 : le périmètre de validation est **macOS uniquement**, conformément à la réponse explicite de l’utilisateur ; Windows ne constitue plus un prérequis de clôture.

Validation globale après extraction des réponses réseau : **717 tests réussis, 1 ignoré**, 147 fichiers réussis (`f35-replies-full-tests.log`, 22,21 s). Les validations navigateur restent distinctes et en cours.


### F35 — sept parcours HUD/cosmétiques revalidés

**Sept parcours réussis en 32,6 secondes**, avec collecte CSS (`f35-cosmetics-final.log`, `f35-cosmetics-final/`). Les cinq parcours cosmétiques utilisent désormais l’identifiant `cosmetics` du registre actuel ; l’ouverture de la fenêtre Apparence, ses onglets, les légendes et la disposition restent vérifiées. La jauge vérifie sa couleur par défaut actuelle, l’en-tête vérifie le raccourci C fourni par le cadre, l’ombre vérifie l’adaptation explicite à 0,8 de `visualNode.tsx`, et le compteur vérifie le texte dynamique de `useCosmetics`. Aucun changement de rendu n’a été introduit pour satisfaire ces assertions. Les autres échecs du parcours large restent à examiner.


### F35 — adaptations des documents UI compilées sur l’hôte

Le plugin `build/preparedUi.ts` applique les transformations stables de `prepared()` lors du build (ou du démarrage du serveur de développement). Il émet un asset JSON nommé par son SHA-256 pour chaque contenu et un manifeste virtuel des routes. Les documents complets chargent ces résultats ; les modèles sources, fragments et créations dynamiques conservent leur chemin actuel. Les cadres dépendant du jeu sont toujours appliqués après chargement. Les fichiers compilés manquants provoquent une erreur explicite. En développement, une modification des arbres sources redémarre le serveur pour reconstruire le manifeste. La configuration TypeScript du build utilise désormais la résolution `bundler`, conformément à son exécution par Vite.

Comparaison exhaustive des sorties avec les transformations originales : **685 documents, 35 415 916 octets JSON, aucune différence** (`f35-ui-corpus-equivalence.json`). Ces octets représentent les assets séparés sur disque, pas un chargement initial groupé. **720 tests réussis, 1 ignoré ; build strict réussi en 5,20 s** (`f35-compiled-ui-full-tests.log`, `f35-compiled-ui-final-build.log`). Les sept parcours HUD/cosmétiques restent réussis après ce changement (**40,8 s**, `f35-compiled-ui-browser.log`). La validation de l’inventaire après compilation est en cours. F35 reste ouvert pour le découpage restant et la couverture CSS des autres parcours.

Les deux parcours d’inventaire après compilation réussissent également (`f35-compiled-inventory.log`) : recherche et aller-retour sac → équipement → sac.


### F35 — visibilité du décor extraite du moteur

`SceneVisibility.ts` possède désormais les bounds en cache des voisins, les entrées statiques, l’invalidation par caméra et le culling. `GameRenderer` conserve l’orchestration et reçoit un booléen indiquant si le viewport a changé. Les marges existantes sont conservées : quatre unités pour le décor statique, 256 unités supplémentaires pour les silhouettes/particules voisines. Deux tests passent sur la limite visible, le zoom, le remplacement de scène et l’élimination des vues détruites ; **build strict réussi en 4,25 s** (`f35-visibility-tests.log`, `f35-visibility-build.log`). Un parcours navigateur de carte/zoom est lancé (`f35-visibility-browser.log`). Le moteur garde encore des responsabilités à découper ; F35 n’est pas clôturé.

Le parcours navigateur de rendu/interaction après zoom réussit en **4,4 s** (`f35-visibility-browser.log`).


### F20 — chronologie et données des séquences conservées

La carte 152337 contient notamment deux plans sans prédécesseur (`ZAAP_ON`, `FADE_OFF`) et un plan `OFF` dépendant de `FADE_OFF`. Le lecteur additionnait auparavant toutes les durées dans l’ordre du tableau et perdait cibles/paramètres lors de la création des événements. `MapEffectSequence` calcule désormais les départs à partir de `previousShot`, conserve les événements complets avec heure de départ/durée, et rejette cycles ou prédécesseurs absents. Une séquence malformée est signalée et comptée comme ignorée sans empêcher le reste de la carte de s’afficher. Les incréments de temps négatifs/non finis ne déplacent plus son horloge.

**Huit tests ciblés réussis** (`f20-sequence-timeline-tests.log`) ; build de la chronologie réussi en 4,66 s (`f20-sequence-timeline-build.log`, avant ajout du diagnostic protégé dans `MapEffects.prepare`). Cette correction prépare le raccordement des actions, mais **ne constitue pas leur implémentation visuelle** : F20 reste ouvert, notamment pour le consommateur des événements et le déclenchement des séquences appropriées.


### F20 — premier consommateur visuel de séquence : arrêt des particules

Les événements de séquence sont désormais drainés à chaque tick de `MapEffects`, puis transmis au consommateur des particules de la carte centrale ou voisine. `ParticlesStopStagingEffect` résout uniquement les émetteurs explicitement marqués `isStagingTarget` avec le même `stagingId` ; aucun remplacement par nom d’asset n’est effectué. La carte 152337 fournit bien `ANO_VOISINE → PTC_ANOMALIE`. `clear=0` arrête les nouvelles émissions et laisse les particules vivre jusqu’à expiration ; `clear=1` retire immédiatement leurs vues et met à jour le batch. Les définitions partagées restent intactes. Les événements sans consommateur ou cible sont comptés comme ignorés, sans annoncer un rendu appliqué.

Les tests couvrent le ciblage exact, les deux modes d’arrêt, la préservation des autres émetteurs et le trajet séquence → tick d’effets → système de particules, consommé une seule fois (`f20-particle-stop-tests.log`). Build réussi (`f20-particle-stop-build.log`). Les autres effets de staging, le déclenchement approprié par état de jeu et la validation visuelle sur cartes témoins restent ouverts ; F20 n’est pas clôturé.


### Validation intégrée — particules et UI de production macOS

Après raccordement de l’arrêt des particules : **728 tests réussis, 1 ignoré**, 149 fichiers réussis (`f20-stop-full-tests.log`, 11,30 s). Le test Electron existant vérifie désormais les réponses réelles des requêtes vers les arbres UI compilés : route SHA-256, protocole `app://`, statut 200, type JSON et document chargé. **Parcours de production réussi en 2,6 s** (`f35-production-ui-electron-responses.log`, pièce jointe `compiled-ui`). La première instrumentation par Resource Timing n’observait pas ces fetches sur ce protocole ; elle a été remplacée par un relevé des réponses fetch réelles, sans modification du code de production. Les contrôles existants des assets locaux et du blocage des hôtes distants restent réussis.

F13 : le processus de génération est toujours actif ; **352 cartes ont un checkpoint de source et de sorties validées** à ce relevé. La publication des 17 353 cartes n’est pas terminée.


### F35 — contrats actuels du chat, des métiers et de l’inventaire

Le chat vérifie désormais le préfixe horaire activé par défaut, tout en conservant les assertions sur le texte envoyé, le survol, le contenu et le fond de l’infobulle. Le métier sélectionné est vérifié par sa bordure actuelle, puis le test clique sur un second métier et vérifie le déplacement de la sélection. **Deux parcours réussis en 42,5 s**, avec collecte CSS (`f35-chat-jobs.log`).

Les assertions sur la première statistique utilisent `hud.life.max` (3 915 dans la fixture), les emplacements vides utilisent `is-empty`, le conteneur de presets est présent comme le demande son binding, et la fenêtre de personnage vérifie les 520 px déclarés dans le registre. Quatre parcours de revalidation sont lancés (`f35-character-inventory.log`) ; aucune logique de production n’est modifiée par ces corrections de tests.

Les quatre parcours statistiques/inventaire/cadre sont **réussis en 18,6 s** (`f35-character-inventory.log`).


### F35 — défaut réel découvert dans le suivi des quêtes

L’inspection de la fixture actuelle (quête 1958, objectif actif 14257) montrait trois objectifs dans le suivi contre un dans le journal. Le suivi ignorait `objectiveIds` et affichait toute l’étape du catalogue. Il filtre désormais les objectifs sur les identifiants actifs lorsqu’ils sont fournis, en distinguant une liste vide d’une liste absente. Un test couvre la sélection d’un objectif et la liste explicitement vide ; **24 tests de repeaters réussis** (`f35-active-objectives-tests.log`). Le build a également permis de compléter le type de la fixture d’intégration des particules ; le build corrigé réussit (`f35-active-objectives-build.log`).

Les tests navigateur de guilde/suivi sont adaptés à la fixture actuelle et relancés (`f35-quest-guild-final.log`). Le journal conserve encore des assertions anciennes, notamment un titre `lbl_objectives` explicitement masqué par `useQuests` ; sa revalidation reste ouverte (`f35-quest-journal.log`).

Guilde et suivi des quêtes : **deux parcours réussis en 13,7 s** (`f35-quest-guild-final.log`).


### F35 — journal fonctionnel, sprite équipé et titre complet vérifiés

Le parcours du journal vérifie désormais l’objectif actif, les récompenses (151 kamas, 6 225 XP), le repli/réouverture de la catégorie Astrub et un filtre de niveau qui exclut puis réaffiche la quête de niveau 15. Il remplace les attentes d’une ancienne quête et de contrôles maintenant masqués. Le sprite équipé est vérifié sur son nœud peint visible `itemTile_asset_asset`, avec l’URL de coiffe 16041, plutôt que sur le conteneur d’équipement.

Le décalage de 19 px du test de titre provenait de l’exclusion de l’icône dans le calcul : l’en-tête centre icône + titre + raccourci. Le test mesure maintenant tout le groupe visible, sans augmenter la tolérance, et conserve les contrôles de raccourci, fond et espacement. **Trois parcours réussis en 16,0 s**, avec collecte CSS (`f35-journal-hat-spell.log`). Aucun changement de rendu pour ces trois corrections de tests. Les quatre échecs initiaux restant à examiner concernent le menu, deux parcours de carte et les succès ; la suite globale doit encore être relancée.


### F35 — dernières attentes historiques de carte/menu/succès

Le menu est vérifié à sa position et taille du registre HUD (top 183, 292 × 124), au lieu de l’ancien état USS (top 55, 42 × 249) ; ce parcours réussit (`f35-banner-achievements.log`). Les succès sont maintenant présentés en cartes de progression par `useAchievements` : le test vérifie affichage, objectifs et recherche avec résultat/absence de résultat/réinitialisation, au lieu d’attendre un résumé masqué par ce hook.

La carte masque explicitement `resourceQuantities` dans son binding actuel. Son centre est limité aux bornes du monde à petite échelle : le parcours vérifie le joueur visible initialement, puis un recentrage après zoom, en conservant filtres, sélection de monde et changement du niveau de tuiles. Les trois parcours carte/succès sont en cours de revalidation (`f35-map-achievements.log`) ; aucune clôture de la couverture CSS globale n’est annoncée.


### F35 — clics de cartographie et requêtes CSS manquantes corrigés

La trace du parcours cartographie prouvait que `questList/lv_main` interceptait les clics sur `btn_anomaly`. La cartographie est un document sans cadre mobile ; elle ne participait pas à l’empilement des fenêtres. Son conteneur se branche désormais sur `windowStackStore`, est remonté après chargement et lors des clics. Les fenêtres classiques conservent leur propre ordre sans nouveau conteneur isolant. Le parcours des modes de carte réussit après ce correctif (`f35-map-stack.log`) ; build réussi (`f35-map-stack-build.log`, 6,28 s).

Le second parcours a ensuite révélé quatre 404 de styles : `SmileyUI`, `widgetManager`, `CartographySearchUI`, `CartographySearchResultItem`. Les arbres JSON existent mais aucune feuille correspondante n’est installée. Ces documents sont exclus des liens CSS inexistants, et les documents sans feuille conservent les styles JSON complets. Revalidation des deux parcours en cours (`f35-map-sheets.log`).

Succès : le filtre trouve bien « On a tous 5 Apéwicubes en commun », mais son premier objectif est vide. L’objectif 2812 référence `nameId=618514`, dont le texte est vide dans les deux catalogues de langue installés. L’assertion d’objectif visible reste en échec ; aucune réussite globale n’est annoncée.

Les deux parcours cartographie sont **réussis en 25,2 s**, sans les quatre 404, avec filtres, modes, sélection de monde, zoom et recentrage (`f35-map-sheets.log`). Build réussi en 10,40 s (`f35-map-sheets-build.log`).


### F35 — objectif de succès : vérification dans les sources officielles

Le diagnostic précédent est précisé après lecture directe des tables `I18n/{fr,en,es,de}.bin` du client installé : le texte 618514 est vide dans les quatre langues. Le succès 933 a pour description officielle « Ouvrir 5 Apéwicubes. » et possède aussi l’objectif 2813, traduit « Niveau 110 ». L’hypothèse d’un texte perdu par l’export n’est donc pas étayée. Le test vérifie désormais description et condition de niveau visible, puis recherche sans résultat et remise à zéro. Aucun libellé n’a été inventé et aucune donnée officielle n’a été réécrite.

La suite complète de **60 parcours** est relancée avec couverture CSS (`f35-css-complete.log`, dossier `f35-css-complete/`), ainsi que tous les tests unitaires (`f35-ui-final-unit.log`). Résultats encore en attente à cette entrée.


### F35 — course au chargement du catalogue dans l’aperçu d’inventaire

Le passage large a révélé que l’aperçu isolé pouvait rendre une grille utilisable avant disponibilité des icônes. Le champ de recherche contenait bien « pomme », mais le sprite attendu n’était pas encore disponible. L’aperçu attend désormais le catalogue avant de monter la grille, ignore les résultats après démontage et propose Réessayer après un échec. Les deux parcours recherche/équipement réussissent après ajout de cette attente (**24,3 s**, `f35-inventory-ready.log`). Le chargement est ensuite limité au groupe `core`, suffisant pour cet aperçu, au lieu des tables supplémentaires de succès/métiers/cosmétiques ; cette dernière réduction est en revalidation (`f35-inventory-core.log`).

La suite unitaire précédente est terminée : **729 tests réussis, 1 ignoré** (`f35-ui-final-unit.log`, 61,24 s sous charge). La collecte large reste en cours et comporte l’échec d’inventaire antérieur au correctif ; elle ne sera pas présentée comme intégralement verte.


### Reprise macOS — revalidation après correction de l’inventaire

Le périmètre F36 reste macOS uniquement. Les deux parcours d’inventaire avec chargement du groupe `core` sont réussis (39,4 s, `f35-inventory-core.log`). La collecte précédente termine à 57 parcours réussis et 3 échecs : les deux parcours d’inventaire antérieurs au correctif et un dépassement de délai du parcours métiers. Une nouvelle passe complète sur le code corrigé est lancée (`f35-css-stable.log`) ; son résultat reste à vérifier.


### F35 — responsabilité chat extraite du client réseau

`SessionChat` regroupe désormais le décodage des trames de chat, le filtrage des états serveur, les identifiants, les abonnements et l’historique borné à 200 lignes. `GinyClient` délègue ces opérations et réinitialise le chat à la fermeture comme auparavant. Les abonnements sont conservés lors de cette réinitialisation, conformément au comportement précédent. Les 729 tests existants réussissent (1 ignoré), ainsi que deux nouveaux tests ciblant la borne d’historique, le filtrage des données machine, le désabonnement et la reconnexion ; build réussi. Preuves : `f35-session-chat-tests.log`, `f35-session-chat-lifecycle.log`, `f35-session-chat-build.log`.

F13 : processus confirmé actif, 576 cartes dans 18 checkpoints au dernier relevé. La nouvelle passe navigateur reste en cours et révèle encore un échec sur les métiers ; elle ne permet pas de clôturer F35.


### F35 — distinguer le succès UI d’une collecte CSS manquante

La trace du parcours `job craft tab keeps` confirme que toutes ses assertions réussissent ; la page se ferme avant la fin de `stopCSSCoverage`, qui échoue. La cause de la fermeture reste à établir. Le collecteur écrit désormais un artefact `css-coverage-error.json` puis propage l’erreur. Le résumeur inclut ces observations manquantes avec un statut `coverage-failed` et sort en erreur, même si les assertions du parcours avaient réussi. Vérification avec une collecte manquante simulée : sortie 1 attendue (`f35-css-error-report.json`). Revalidation ciblée du parcours et de sa collecte lancée (`f35-job-coverage-recheck.log`). Aucun échec n’est masqué.


### F35 — couverture multi-écrans collectée ; F33 — identités qualifiées

La passe large termine à **59 réussites et 1 échec de collecte CSS** (fermeture de page après assertions métiers réussies). Le parcours concerné réussit ensuite avec sa collecte en **19,8 s** (`f35-job-coverage-recheck.log`). L’union des 59 collectes de cette passe et de la revalidation contient **60 scénarios, 65 contenus CSS distincts, 1 320 353 unités UTF-16 dont 387 203 observées utilisées** (`f35-css-observed-summary.json`). Il ne s’agit pas d’une passe unique intégralement réussie ni d’une preuve que le reste des règles est mort. Les traces de l’échec sont conservées.

F33 : le script exploratoire exclut désormais les correspondances numériques des bundles Effects pour les demandes `gfx/`. Seules les identités des bundles de décors 1x ou les chemins qualifiés du conteneur Effects peuvent être retenus. Le scan se termine sans erreur, avec **0 récupération et 815 dépendances toujours non résolues** (`f33-qualified-source-scan.log`, `.local/audit-source-recovery-qualified/report.json`). Aucun candidat d’une autre catégorie n’est installé. Cette vérification porte sur les familles de bundles scannées, sans prouver l’absence dans toutes les sources Unity.


### F33 — piste des bundles de props vérifiée

Les 639 dépendances `mapgfx` non résolues ont été comparées aux chemins officiels `Animations/Props/props_assets_prop_<id>.bundle` utilisés par `export_prop` : **aucun de ces 639 chemins n’existe** dans le client installé. Les 13 erreurs de props de l’état d’extraction pointent également vers cette famille ; les exemples 15363 et 30814 ne correspondent à aucun nom de fichier dans le contenu installé. Preuve détaillée : `f33-missing-gfx-prop-bundles.json`. L’inventaire des sources recense notamment 736 bundles de props, 29 de textures de cartes et 1 de textures d’effets (`f33-source-bundle-inventory.json`). Ce constat écarte la récupération directe par identifiant de prop ; il ne prouve pas une absence dans tout objet interne aux autres bundles. F33 reste ouvert.


### F20 — une séquence invalide ne conserve plus d’événements précédents

Le démarrage commence désormais par annuler l’état de lecture précédent. Une erreur de graphe annule aussi les événements en attente ; auparavant ils pouvaient survivre à un démarrage échoué. Les identifiants de shots dupliqués et les délais/durées non finis sont rejetés explicitement, afin de ne pas supprimer silencieusement un événement ou maintenir une lecture sans fin. Un test vérifie le rejet, la purge et la reprise ultérieure d’une séquence valide. **Quatre tests ciblés réussis** (`f20-sequence-validation.log`). Build lancé dans `f20-sequence-validation-build.log`. Les familles visuelles et les déclencheurs de jeu encore absents restent ouverts.


### F20 — inventaire exhaustif des actions de staging lancé

Le build du correctif de validation des séquences est réussi (`f20-sequence-validation-build.log`). Un parcours de toutes les cartes compressées est en cours pour compter les types `StagingEffect` et conserver un exemple de paramètres par type (`f20-staging-actions.json`, produit à la fin du scan). Le prochain consommateur doit correspondre à ces paramètres effectivement exportés. Le processus atlas est également confirmé actif.


### F35 — outils d’inspection hors des imports statiques de l’entrée

`App` charge désormais les modules de dump de boîtes et d’inspection UI par imports dynamiques dans un effet conditionné par `DEV`. Un démontage avant résolution empêche leur installation ; un démontage après installation appelle les deux nettoyages. Le raccourci d’inspection reste disponible en développement après chargement. Build strict réussi (`f35-deferred-inspection-build.log`). La revalidation de ces outils en développement reste à effectuer.


### F35 — inspection différée vérifiée en navigateur

Sur la route HUD avec `ui-inspect=1`, le navigateur macOS observe un seul hôte d’inspection, `__uiInspect` installé et activé, `__dumpClientBoxes` disponible et un dump contenant **609 boîtes** (`f35-deferred-inspection-browser.json`). Cela vérifie le fonctionnement après import différé sous le montage StrictMode de l’application. Le build de production est réussi et ne contient ni `giny-ui-inspector-host` ni `__dumpClientBoxes` dans ses assets JavaScript. Le navigateur de vérification est fermé après le relevé.


### F20 — résultat de l’inventaire des actions de staging

Le scan des cartes compressées est terminé (`f20-staging-actions.json`). Il relève **17 types** : notamment Translation 40 885 occurrences, ParticleMain 39 146, Dissolve 33 851, NoAnimAlpha 19 117, Emissive 17 713, ParticleEmission 12 528, ParticlesPlay 5 277 et ParticlesStop 4 267. Ce sont des occurrences dans les documents, pas des effets distincts ni des mesures de coût. Les exemples conservent la carte, les cibles et les paramètres complets. `ParticlesPlayStagingEffect` cible par exemple `PTC_ZAAP` sur la carte 147590153 ; son consommateur manque encore. Les transformations et interpolations représentent une part majeure du travail restant, au-delà du seul arrêt des particules déjà raccordé.


### F20 — consommateur de démarrage des particules

`ParticlesPlayStagingEffect` est raccordé aux émetteurs portant les cibles de staging exactes. L’état de lecture est local au runtime ; une définition initialement `stopped` peut démarrer sans mutation du document partagé. Le démarrage réinitialise temps/fraction et applique le délai lorsque le système était arrêté. Le test couvre cible inconnue, arrêt initial, délai, émission, clear et redémarrage ; **15 tests de particules réussis** (`f20-particle-play-tests.log`). Build en cours (`f20-particle-play-build.log`). Référence de comportement consultée : https://docs.unity3d.com/ScriptReference/ParticleSystem.Play.html. Le préchauffage au redémarrage, la propagation éventuelle aux enfants, la persistance de cet état dans les snapshots et la fidélité visuelle restent à vérifier ; cette première implémentation ne clôture pas la famille staging.


### F20 — état de lecture conservé dans les snapshots

Les snapshots exportent désormais un bloc optionnel `playback` lorsque le staging a modifié la lecture. Il contient deux booléens validés avant hydratation : arrêt des émissions et activation par staging. Les fichiers offline v1 sans ce bloc conservent exactement leurs valeurs implicites antérieures ; leur représentation et leur hash de source ne changent pas. Une restauration ne réactive plus un émetteur arrêté et ne bloque plus un émetteur initialement arrêté puis démarré. Le test couvre ces deux cas et le rejet sans allocation d’un flag malformé. **16 tests de particules réussis**, build réussi (`f20-playback-state-tests.log`, `f20-playback-state-build.log`). Cette extension corrige la persistance ; préchauffage et validation visuelle du démarrage restent ouverts.


### F20 — préchauffage progressif après redémarrage

Un émetteur de staging arrêté, vide, bouclé et marqué `prewarm` reprend désormais le même préchauffage borné que lors de sa création, via `ParticleWarmBudget`. La durée reste plafonnée à 30 secondes simulées ; le conteneur est masqué jusqu’à la fin. Le test prouve zéro émission sous budget nul, progression partielle sous budget d’une étape, puis complétion. **17 tests ciblés réussis** (`f20-play-prewarm-tests.log`). Build et suite complète lancés (`f20-play-prewarm-build.log`, `f20-playback-full-tests.log`). La validation visuelle et les autres familles de staging restent ouvertes.


### F20 — résolution des cibles de transformation vérifiée

Sur la carte 237764634, `T_portail_A_28` résout le matériau `sortable[68]`, GFX 92027, portant `ShaderTranslationParameters` et `ShaderScaleParameters` (`f20-translation-target.json`). L’action de translation anime `offset` de 0 à −1548 ; la direction matérielle vaut `(0, 0.75)`, avec un bruit qualifié 2026. La cible est donc un état de matériau, pas un déplacement direct de conteneur. Le consommateur devra interpoler les champs actifs sur une copie d’état locale et propager le résultat aux instances de ce matériau, sans modifier le document partagé. La gestion du bruit reste nécessaire pour sa fidélité complète. Suite intégrée précédente : **735 tests réussis, 1 ignoré**, build réussi (`f20-playback-full-tests.log`, `f20-play-prewarm-build.log`).


### F20 — premier raccordement des paramètres de transformation

`MaterialSequence` résout les cibles par `stagingId`, interpole les champs scalaires/vectoriels actifs connus des translations, rotations et échelles, puis conserve les valeurs finales. Les meshes déformés possèdent maintenant une copie locale de leurs paramètres ; `MapEffects.adopt` les enregistre et le tick GPU relit les valeurs interpolées. Des champs actifs inconnus ou `resetTime` font rejeter l’action entière. Deux tests ciblent interpolation multi-instance, valeur finale, nettoyage et rejet atomique. Build réussi (`f20-material-sequence-build.log`), tests dans `f20-material-sequence-tests.log`. Ce raccordement est partiel : sprites non déformés, synchronisation exacte au temps de début, courbes spécifiques, resetTime, bruit, alpha/dissolve et validation visuelle restent à traiter. F20 reste ouvert.


### F20 — transformations synchronisées à l’horloge de séquence

Les événements de matériau reçoivent désormais le retard réel `playbackTime - startedAt`. Leur première valeur correspond donc au temps déjà écoulé, y compris lorsqu’une image franchit toute leur durée. La séquence est consommée avant la mise à jour des matrices GPU pour supprimer le décalage d’une image. Un test couvre début retardé, progression et action déjà terminée. **Sept tests ciblés réussis** (`f20-material-timing-tests.log`). Build lancé dans `f20-material-timing-build.log`. Cette correction concerne les transformations raccordées ; elle ne valide pas les autres consommateurs ni la fidélité des effets encore absents.


### F20 — propagation aux matrices GPU et lacune de culling identifiée

Un test relie maintenant l’interpolation du matériau aux lignes affines consommées par le GPU : à mi-parcours de l’offset −1548, avec direction Y=0,75, le déplacement source vaut −580,5 et la translation du canvas Y inversé vaut +580,5 ; le paramètre source reste à zéro (`f20-material-gpu-rows.log`). Cette preuve porte sur les coefficients, pas sur les pixels rendus. Le culling conserve encore des bornes calculées lors de la création avec `extraBounds` : un grand déplacement de staging peut dépasser cette marge. Des bornes conservatrices couvrant les transformations animées restent nécessaires avant validation visuelle complète.


### F20 — enveloppe de culling des transformations

`stagingBounds` calcule à la création une enveloppe conservatrice des translations, échelles et rotations connues sur toute la séquence, à partir des paramètres initiaux et des bornes des champs actifs. `paintMapElements` la raccorde aux bornes utilisées par la carte centrale, sans recalcul de géométrie à chaque image. Le test du portail couvre le déplacement de 1 161 unités, préserve les bornes sources et exclut les cibles non correspondantes (`f20-staging-bounds-tests.log`). Build réussi (`f20-staging-bounds-build.log`). Les bornes mises en cache des cartes voisines restent à raccorder à cette enveloppe ; coût du culling plus conservateur et fidélité visuelle restent à mesurer.


### Validation intégrée du rendu après staging

Le build benchmark actuel et le parcours Electron local réussissent : **15,6 s**, cartes 154644, 153878788 et 153880836, sans erreur JavaScript selon les assertions existantes. Artefacts `f20-integrated-electron/`, `f20-integrated-electron.log`, `f20-integrated-electron-summary.json`. Ce parcours valide le chargement et le rendu intégrés du corpus ; sa courte fenêtre ne prouve ni endurance ni fidélité des séquences sur leurs cartes témoins. Les trois tests de bornes/visibilité précédents réussissent également (`f20-neighbour-bounds-tests.log`).

Le lanceur local `session-validation.py` accepte maintenant une commande de validation sous forme de tableau JSON et une durée limite, tout en conservant le nettoyage des serveurs et bases temporaires dans `finally`. Vérification syntaxique réussie. Le parcours production de jeu complet reste à raccorder et exécuter ; F36 reste ouvert.


### F36 — parcours Electron de production lancé sur serveurs isolés

Le test Electron existant dispose d’une étape optionnelle `productionSession` : garde stricte sur le port Auth isolé 18453, authentification, sélection du serveur et du personnage, attente de sprites réellement chargés et HUD visible, capture du rendu et des erreurs JavaScript. Il utilise `dist` et les véritables serveurs Auth/World clonés par le lanceur, sans serveur fictif. Exécution lancée dans `f36-isolated-session.log` ; résultat en attente. Cette étape ne couvre pas encore combat, changement de carte ni focus/endurance. Les anciennes lignes de `session-smoke.log` ne constituent pas un résultat du nouveau parcours tant que le lanceur ne l’a pas réécrit.


### F36 — configuration du port World corrigée

Le premier parcours Electron authentifie correctement le compte et reçoit `SelectedServerDataMessage`, puis reste avant la sélection du personnage. Le lanceur ne transmettait pas `GINY_WORLD_PORT=15565` ; Electron n’acceptait donc que son port World par défaut 5555. Le lanceur transmet désormais les deux ports isolés, sans assouplir la politique locale. Les serveurs et bases du premier essai sont nettoyés (`f36-isolated-session.log`), la trace est conservée. Relance en cours (`f36-isolated-session-world-port.log`). Le parcours inclut aussi une perte de focus au profit d’une fenêtre Electron temporaire, sa fermeture, la reprise effective du focus et la conservation de la carte/HUD. Résultat en attente.


### F36 — entrée réelle en jeu atteinte ; attente de test corrigée

Avec le port World isolé, Auth/World et la sélection du personnage fonctionnent ; la trace affiche le HUD et Incarnam. Le test échouait ensuite car `.world-identity` appartient uniquement à `MapPreview`, pas à `WorldView`. Il attend désormais le canvas visible, la disparition du chargement et l’absence de message d’erreur du véritable écran de jeu. Une capture PNG du canvas est conservée pour inspection visuelle ; sa simple présence ne sera pas assimilée à une preuve de pixels corrects. Le contrôle de reprise du focus conserve visibilité et dimensions du canvas. Nouveau passage lancé (`f36-isolated-session-canvas.log`). Nettoyage du passage précédent confirmé.


### F36 — rendu de production inspecté, test de focus à reprendre

La capture `f36-production-session-canvas/.../production-world-canvas.png` est inspectée : carte Incarnam, personnages, portail, chat et HUD visibles ; le canvas n’est pas vide. Le parcours atteint le contrôle de focus, qui échoue car `document.hasFocus()` reste vrai après création de la fenêtre temporaire. Le mécanisme de test charge désormais explicitement `about:blank`, active l’application puis focalise cette fenêtre. Les assertions sont conservées. Nettoyage du passage précédent confirmé ; relance `f36-isolated-session-focus.log` en cours. Aucun succès de reprise du focus n’est encore annoncé.


### F36 — émulation de focus du pilote identifiée

Le second mécanisme de fenêtre produit encore `document.hasFocus() === true`. Inspection du pilote installé : Playwright appelle `Emulation.setFocusEmulationEnabled` avec `enabled: true` (`playwright-core/lib/coreBundle.js`, ligne 37399). Le test désactive explicitement cette émulation sur la page de jeu avant le transfert natif du focus ; les assertions false puis true sont conservées. Le passage précédent est nettoyé. Relance en cours (`f36-native-focus.log`). Ce diagnostic concerne le banc de validation, pas un défaut de focus démontré du client.


### F36 — changement de carte validé séparément du focus

La perte de focus reste non observée après désactivation de l’émulation ; le test reste en échec (`f36-native-focus.log`) et le nettoyage est confirmé. Un passage indépendant de changement de carte est lancé avec le contrôle de focus explicitement omis (`E2E_SKIP_SESSION_FOCUS=1`, `f36-map-change.log`). Il observe les vraies trames `CURRENT_MAP`, demande une téléportation via le chat administratif du serveur isolé, attend l’identifiant de destination reçu puis capture le rendu sans erreur de chargement. Une réussite de ce passage ne devra pas être présentée comme une validation du focus. Résultat en attente.


### F36 — faux positif du changement de carte détecté par la capture

Le passage annonce un test réussi en 9,2 s, mais l’inspection de `production-destination.png` montre encore un écran noir de chargement. La réception de `CURRENT_MAP` précède le montage de la transition UI ; l’attente d’absence d’un indicateur pouvait donc réussir trop tôt. **Ce passage ne valide pas le rendu de destination.** `WorldView` expose maintenant `data-ready-map` sur son viewport uniquement au rappel de fin de chargement du renderer, et le retire au début du suivant. Le test attend cet identifiant exact puis l’absence globale du chargement. Build lancé (`f36-map-readiness-build.log`). Les bases et serveurs du passage précédent sont nettoyés.


### F36 — changement de carte réel et rendu de destination validés

Le passage corrigé réussit en **21,8 s** (`f36-map-ready.log`, journal de test). La capture `f36-map-ready/.../production-destination.png` est inspectée : Incarnam–Champs, tour, personnage et HUD effectivement rendus ; elle remplace le faux positif de l’écran de chargement. Le message de destination serveur et `data-ready-map` exact sont vérifiés. Nettoyage des serveurs et bases temporaires confirmé. Le focus reste exclu de ce passage. Un diagnostic Electron sans bases teste désormais réduction/restauration native (`f36-focus-only.log`) pour éviter de réimporter les bases à chaque essai de focus.


### F36 — diagnostic du focus indépendant des bases

Le test sans serveurs constate encore `hidden:false/focused:true` après réduction de la fenêtre. Une variante masque la fenêtre et joint ses états natifs (`isVisible`, `isMinimized`, `isFocused`, inventaire des fenêtres) avant de contrôler la page. Elle restaure la fenêtre dans `finally`. Passage `f36-focus-hide.log` en cours ; aucun changement du comportement de focus du client. Le diagnostic reste distinct des validations déjà acquises de connexion et de changement de carte.
