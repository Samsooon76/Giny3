# Encyclopédie : raccordement au moteur d’interfaces

La fenêtre `encyclopediaBase` extraite contient les hôtes `tabs` et `uiCtr`, mais aucun onglet ni corps instancié. Le contrôleur officiel les ajoute à l’exécution. Le rendu vide venait donc d’un contrôleur manquant, pas d’un besoin de réécrire l’écran en JSX.

## Implémentation

- `client/web/src/ui/game/encyclopedia.ts` charge les tables extraites et la traduction, instancie les cinq onglets et raccorde les événements aux données.
- Les corps sont `bestiaryTab` et `encyclopediaList`. Les lignes restent `bestiaryTabItem` et `encyclopediaItem`, interprétées par le moteur commun.
- Les hôtes `GenericFilterCategory` vides reçoivent un adaptateur partagé pour leur intérieur construit à l’exécution. Les objets utilisent le fragment `bestiaryTab#sidePanel`, chargé par le moteur sans recopier l’arbre.
- `ListView` conserve séparément la hauteur de cellule et celle du contenu, pour respecter l’espace entre cartes.
- Les portraits de monstres utilisent le moteur EntityLook, activé seulement lorsque leur emplacement est visible.
- Le contrôleur relie recherche, territoire, famille/type d’objet, niveaux, monde, région, faiblesses élémentaires, tri par niveau/nom et catégories de butin. Les résultats sont paginés par 40 via le compteur inférieur.
- Cosmétique correspond à la catégorie de données 5 ; la catégorie 3 désigne les objets de quête.

## Vérification et limites

La sélection Pâturages retrouve Boufton Orageux, Boufton Pâlichon, Bouftor Éthéré et Bouftou Nuageux. Les captures peuvent montrer des objets ou des territoires différents si leurs versions de données diffèrent.

Les filtres proposent actuellement une valeur par groupe, avec des seuils de niveau prédéfinis et des faiblesses élémentaires. Ils ne reproduisent pas encore toutes les variantes de saisie de l’officiel. La localisation expose les territoires en infobulle ; elle ne lance pas une recherche sur la carte. Le détail complet d’un objet/monstre n’est pas raccordé ici. Les prix de marché restent indisponibles et l’éligibilité personnelle aux butins conditionnés reste désactivée : ces informations nécessitent un raccordement supplémentaire.

## Processus pour la prochaine interface différente

1. Comparer sa capture, son arbre extrait et le DOM rendu à proportions équivalentes.
2. Si une zone est absente de l’arbre : identifier le constructeur ou l’instanciation dynamique, puis ajouter un adaptateur de composant ou un repeater vers l’arbre source.
3. Si la zone existe mais se place mal : corriger le moteur commun (dimensions, cellule de liste, ancrage, styles), avec un test ciblé de la règle.
4. Si les contrôles existent mais restent vides : relier le contrôleur aux tables et à l’état serveur.
5. Vérifier les interactions et une autre fenêtre utilisant les composants modifiés. Documenter les écarts restants au lieu de fabriquer des valeurs.
