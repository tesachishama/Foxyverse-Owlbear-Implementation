# Syntaxe des emplacements d’équipement (inventaire)

[English (EN)](../equipment-slots.md)

Ce document décrit la **syntaxe des expressions d’emplacements** telle qu’implémentée par l’extension pour les objets d’inventaire (armes et armures).

L’expression définit sur quel(s) emplacement(s) un objet **peut** être porté et, une fois équipé, sur le(s)quel(s) il **occupe** réellement de la place.

Implémentation : [`src/data/equipSlots.js`](../../src/data/equipSlots.js).

## Concepts

- **Emplacement (slot)** : un lieu d’équipement unique, écrit comme identifiant nu (ex. `hat`).
- **Groupe** : ensemble nommé d’emplacements, entre crochets (ex. `[head]`).
- **Expression** : combine emplacements et groupes avec des opérateurs pour produire une ou plusieurs **options d’équipement**.
- **Option d’équipement** : ensemble concret d’IDs d’emplacements (ex. `hat + pendant2`) sélectionnable dans la liste déroulante.
- **Emplacement spécial `other`** : capacité illimitée ; autant d’objets que souhaité peuvent être équipés sur `other`.

## Identifiants d’emplacements (canoniques) et alias

Les comparaisons sont insensibles à la casse ; les espaces autour des opérateurs sont ignorés.

### Armes

- `weapon1` (`arme1`)
- `weapon2` (`arme2`)
- `weapon3` (`arme3`)

### Tête / visage

- `hat` (`chapeau`)
- `face` (`visage`)

### Collier

- `pendant1` (`pendentif1`)
- `pendant2` (`pendentif2`)
- `pendant3` (`pendentif3`)

### Haut du corps

- `torso` (`torse`)
- `rshoulder` (`epauled`)
- `lshoulder` (`epauleg`)
- `rarm` (`brasd`)
- `larm` (`brasg`)
- `rwrist` (`poignetd`)
- `lwrist` (`poignetg`)

### Doigts main droite

- `rthumb` (`pouced`)
- `rindex` (`indexd`)
- `rmiddle` (`majeurd`)
- `rring` (`annulaired`)
- `rpinky` (`auriculaired`)

### Doigts main gauche

- `lthumb` (`pouceg`)
- `lindex` (`indexg`)
- `lmiddle` (`majeurg`)
- `lring` (`annulaireg`)
- `lpinky` (`auriculaireg`)

### Bas du corps

- `belt` (`ceinture`)
- `rleg` (`jambed`)
- `lleg` (`jambeg`)
- `rankle` (`chevilled`)
- `lankle` (`chevilleg`)
- `rfoot` (`piedd`)
- `lfoot` (`piedg`)

### Spécial

- `other` (`autre`)

## Groupes (canoniques) et alias

Les groupes s’étendent aux emplacements canoniques listés.

- `[weapons]` (`[armes]`) : `weapon1`, `weapon2`, `weapon3`
- `[head]` (`[tête]`) : `hat`, `face`
- `[necklace]` (`[collier]`) : `pendant1`, `pendant2`, `pendant3`
- `[upper]` (`[haut]`) : `torso`, `rshoulder`, `lshoulder`, `rarm`, `larm`, `rwrist`, `lwrist`, tous les doigts
- `[shoulders]` (`[epaules]`) : `rshoulder`, `lshoulder`
- `[arms]` (`[bras]`) : `rarm`, `larm`
- `[wrists]` (`[poignets]`) : `rwrist`, `lwrist`
- `[fingers]` (`[doigts]`) : tous les doigts (droite + gauche)
- `[rfingers]` (`[doigtsd]`) : doigts main droite
- `[lfingers]` (`[doigtsg]`) : doigts main gauche
- `[lower]` (`[bas]`) : `belt`, `rleg`, `lleg`, `rankle`, `lankle`, `rfoot`, `lfoot`
- `[legs]` (`[jambes]`) : `rleg`, `lleg`
- `[ankles]` (`[chevilles]`) : `rankle`, `lankle`
- `[feet]` (`[pieds]`) : `rfoot`, `lfoot`
- `[fullrarm]` (`[brasdcomplet]`) : `rshoulder`, `rarm`
- `[fulllarm]` (`[brasgcomplet]`) : `lshoulder`, `larm`
- `[fullrleg]` (`[jambedcomplete]`) : `rleg`, `rfoot`
- `[fulllleg]` (`[jambegcomplete]`) : `lleg`, `lfoot`

## Opérateurs

### ET (`&`, `+`, `AND`)

Exige plusieurs emplacements en même temps (occupe tous).

Exemple : `hat & pendant1` → doit occuper `hat` **et** `pendant1`.

### OU (`|`, `OR`)

Fournit des alternatives.

Exemple : `hat | face` → peut occuper `hat` **ou** `face`.

### Quantité (`*`)

S’applique à un **groupe** et signifie « choisir N emplacements distincts dans le groupe ».

Exemple : `[fingers]*2` → occupe deux doigts distincts au choix.

Valeur spéciale : `[head]*all` → occupe **tous** les emplacements du groupe (`hat` et `face`).

### Parenthèses (`( ... )`)

Contrôle la priorité.

Exemple : `hat + (pendant1 | pendant2)` → occupe `hat` et soit `pendant1` soit `pendant2`.

### Exclusion (`-`)

Retire des emplacements d’un groupe avant le reste de l’évaluation.

Exemple : `[fingers] - (rthumb | lthumb)` → tout doigt sauf les pouces.

## Priorité d’évaluation

De la plus forte à la plus faible :

1. Parenthèses `( ... )`
2. Quantité `*`
3. Exclusion `-`
4. ET (`+`, `&`, `AND`)
5. OU (`|`, `OR`)

## Comportement de l’interface (liste déroulante)

Pour l’expression d’un objet, l’extension propose :

- **Déséquipé** (toujours)
- Chaque option d’équipement calculée (chaîne lisible `emplacement + emplacement + …`)
- **Other** (toujours ; équipement sur l’emplacement spécial `other`)

### Options désactivées

Si une option occuperait un emplacement **autre que `other`** déjà pris par un autre objet :

- elle est affichée mais **désactivée**
- grisée visuellement
- triée en bas de la liste

## Persistance (champs base)

### `public.item.usable_slots` (jsonb)

Règle d’équipabilité en JSON :

```json
{ "expr": "(hat + [necklace]) | (face + [necklace]*2)" }
```

### `public.item.used_slots` (jsonb)

Emplacements actuels si l’objet est équipé :

```json
{ "equippedSlots": ["hat", "pendant2"] }
```

Si déséquipé : `null` (ou absence de `equippedSlots`).

## Exemples

- `hat + pendant1`  
  Options : `hat + pendant1`, `other`

- `hat | face`  
  Options : `hat`, `face`, `other`

- `[necklace]*2`  
  Options : `pendant1 + pendant2`, `pendant1 + pendant3`, `pendant2 + pendant3`, `other`

- `(hat + [necklace]) | (face + [necklace]*2)`  
  Options : `hat + pendant1`, `hat + pendant2`, `hat + pendant3`, `face + pendant1 + pendant2`, `face + pendant1 + pendant3`, `face + pendant2 + pendant3`, `other`
