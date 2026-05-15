# Onglet Sorts

[English (EN)](../tab-spells.md)

Gestion de la **liste de sorts** : noms, effets, coûts, drapeaux, compteur d’utilisation et lancement (**UTILISER**).

## Qui peut modifier

Ajouter/supprimer des sorts, réordonner par glisser-déposer, modifier les champs et **UTILISER** nécessitent la permission **édition** sur la feuille.

## Interface de liste

Chaque sort est une ligne avec :

- **Poignée de réordonnancement** — glisser-déposer pour l’ordre (persisté en base).
- **Nom** — chevron pour déplier ; en édition, champ texte.
- **UTILISER** — paie le **coût** en PM ou PV (voir ci-dessous), puis incrémente le compteur **utilisé**.
- **Chevron** — replier / déplier les détails.

## Détails dépliés

- **Effet** — texte libre ; en affichage, même rendu riche que le chat (**boutons de jet inline** — voir [Jets et boutons inline](rolls-and-inline.md)).
- **Coût** — valeur numérique ; bascule **PM** / **PV** en édition.
- **Armé** / **Continu** — options de règles (persistées sur la ligne sort).
- **Utilisé** — `+` / `−` pour ajuster le nombre d’utilisations (sauvegarde différée).

## Lancer (UTILISER)

- **Coût en PM** — déduit les PM si suffisants ; sinon le jeu peut proposer de compléter avec des PV (personnages non élémentaires).
- **Coût en PV** — déduit les PV avec confirmation si le sort serait dangereux.
- **Personnages élémentaires** (voir [Réglages](tab-settings.md)) : un sort réglé sur **PV** est payé depuis les **PM** à la place (compatibilité avec max PV = 1).

## Ajouter / retirer

- **+** — nouveau sort.
- **−** — retirer un sort (modal de choix si besoin).

## Base de données

Table `spell` par feuille. Libellé **élément** optionnel si une migration l’a ajouté.
