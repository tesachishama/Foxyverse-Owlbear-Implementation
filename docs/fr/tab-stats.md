# Onglet Stats

[English (EN)](../tab-stats.md)

Ressources de combat, valeurs dérivées, défenses, graphique **radar** et **talents** (y compris les talents liés aux objets équipés).

## Qui peut modifier

Tous les steppers et actions sur les talents respectent la permission **édition** sur la feuille active. En lecture seule, les valeurs s’affichent sans modification possible.

## Bloc Santé

- **Maximum** — lecture seule ; calculé (constitution, niveau, et règle **élémentaire** le cas échéant : max PV = 1).
- **Actuels** — points de vie actuels (modifiable dans la plage valide).
- **Temporaires** — PV temporaires (modifiable). Pour les **élémentaires**, les dégâts magiques/bruts consomment d’abord les PV temp., puis le surplus enlève de la **mana** ; les PV actuels ne sont pas réduits par ces dégâts (voir Réglages).

## Mana et Faveur

- **Mana** — maximum (formule habituelle ou formule élémentaire) et PM actuels.
- **Faveur** — maximum et actuelle ; sert aux relancements par faveur dans la fenêtre de jet.

## Actions et vitesse

- **Actions** — total (base calculée + bonus).
- **Vitesse** — bouton de jet selon la formule affichée ; bonus modifiable.

## Défenses

- **Physique** et **magique** — totaux issus de l’armure équipée (pilules en lecture seule). Les élémentaires affichent **infini** (∞) pour la défense physique à l’écran ; la défense magique reste numérique.

## Radar et statistiques détaillées

- **Radar** — résumé visuel des totaux de base.
- **Tableau détaillé** — **base** par caractéristique (contraintes niveau 1 le cas échéant), bonus **objet** (lecture seule), bonus **passif** modifiable.

## Talents

- **Talents de feuille** — grille ; clic pour lancer (selon **Jet rapide auto** dans Réglages : clic normal vs Maj+clic pour la préparation de jet).
- **Talents liés à un objet** — armes et armures peuvent porter un talent ; affichés dans la grille avec marquage ; ceux des objets équipés se comportent comme les autres pour les jets.

## Voir aussi

- [Jets et boutons inline](rolls-and-inline.md) — variables `maxhp`, `curmp`, `pdef`, `mdef`, etc.
- [Inventaire](tab-inventory.md) — origine des défenses et des talents d’objet.
