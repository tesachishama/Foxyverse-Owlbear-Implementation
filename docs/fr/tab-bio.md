# Onglet Bio

[English (EN)](../tab-bio.md)

Identité du personnage et niveau. Les données sont enregistrées dans Supabase (table `bio`, liée à la feuille active).

## Qui peut modifier

Les champs sont **en lecture seule** si vous n’avez pas la permission **édition** sur la feuille courante. Les éditeurs voient les champs saisissables.

## Champs

- **Nom** — prénom (texte libre).
- **Nom de famille** — texte libre.
- **Élément** — libellé d’affinité ou d’élément (texte libre ; ce n’est **pas** le drapeau règles « élémentaire » de l’onglet Réglages).
- **Classe** — classe ou archétype (texte libre).
- **Niveau** — entier ≥ 1. Champ numérique ou flèches haut/bas. Le niveau alimente les valeurs dérivées de l’onglet **Stats** (PV/PM max, faveur, base d’actions, etc.).

## Contexte de feuille

L’onglet Bio reflète toujours le **personnage sélectionné** dans l’extension. Changer de feuille (sélecteur dans l’en-tête) charge la bio correspondante.

## Voir aussi

- Les formules peuvent utiliser le niveau via `lvl` ou `niv` ([Jets et boutons inline](rolls-and-inline.md)).
