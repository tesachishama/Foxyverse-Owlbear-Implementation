# Onglet Inventaire

[English (EN)](../tab-inventory.md)

Équipement, consommables, sacs, divers, **monnaie** et **transfert d’objets**. Les caractéristiques des objets et les **expressions d’emplacements** alimentent l’onglet **Stats** (défenses, bonus passifs issus du matériel).

## Qui peut modifier

Ajout/suppression d’objets, champs, équipement et monnaie nécessitent la permission **édition** sur la feuille.

## Diagramme d’équipement

La **silhouette** montre les emplacements canoniques (armes, armure, bijoux, etc.). Cliquer sur un emplacement (ou l’objet lié) met en avant les lignes d’inventaire. Les objets équipés occupent les emplacements définis par leur expression **usable slot**.

## Sections

Selon le contenu de la feuille :

- **Armes / armures / équipé** — dégâts et défenses ; bonus de caractéristiques ; nombre d’emplacements d’arme ; expression d’emplacements.
- **Consommables**, **Divers**, **Sacs** — quantités, descriptions ; les sacs peuvent contenir d’autres éléments selon le modèle de données.

## Équiper

Chaque objet équipable a une **liste déroulante** des placements valides générés par son expression, plus **Déséquipé** et **Other**. Les emplacements réels déjà pris par un autre objet apparaissent **désactivés**. Syntaxe : [Emplacements d’équipement](equipment-slots.md).

## Carte d’objet

Selon le type : nom, description, stats, défenses, expression d’emplacements, ligne **talent** (ajouter/modifier/supprimer un talent lié à cette arme ou armure), transfert vers un autre personnage, etc.

## Monnaie

Or / argent / cuivre avec flux d’ajout, retrait et transfert (modales). Persisté par feuille.

## Voir aussi

- [Syntaxe des emplacements](equipment-slots.md)
- [Stats](tab-stats.md)
