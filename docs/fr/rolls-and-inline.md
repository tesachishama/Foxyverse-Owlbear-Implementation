# Jets (chat et boutons inline)

[English (EN)](../rolls-and-inline.md)

Fonctionnement des **commandes de jet dans le chat**, des **boutons de jet inline** et de la **syntaxe des formules** dans l’extension Foxyverse pour Owlbear.

Références dans le code :

- [`src/dice/roller.js`](../../src/dice/roller.js) — types de jets, répétitions, plafonds/planchers, application à la feuille
- [`src/dice/parser.js`](../../src/dice/parser.js) — analyse des formules et contexte des variables (`buildFormulaContext`)

## Démarrage rapide

### Jet depuis le chat

Une ligne commence par `/`, puis le **type de jet**, puis la **formule** :

```text
/<type> <formule>
```

Exemples :

```text
/str +3
/pdmg 2d4+1
/roll 1d20+2
```

Le message **enregistré en base** est la **ligne de résultat** générée, pas votre `/commande` d’origine.

### Jet depuis les notes ou le chat (boutons inline)

Dans le texte rendu en contenu riche (messages du chat, aperçu des **Notes**), insérez :

```text
[<type> <formule>]
```

Exemples :

```text
[str +3]
[pdmg 2d4+1]
[roll 1d20+2]
```

En **mode affichage**, ce sont des boutons cliquables. En **mode édition**, vous voyez la syntaxe brute entre crochets.

## Multi-jets (nombre de répétitions)

Placez un entier **nombre de répétitions** comme **premier jeton** de la formule :

```text
/str 5 +3
[str 5 +3]
```

Signification : 5 jets de caractéristique, chacun équivalent à `1d20+3`.

```text
/pdmg 10 2d4
[pdmg 10 2d4]
```

Signification : 10 jets de `2d4`.

Règles :

- Le nombre est borné entre **1** et **100**.
- Un relancement par faveur refait **tout le lot** pour les multi-jets.
- Pour `pdmg` / `mdmg`, le bouton **Appliquer** utilise la défense **par jet**, pas une seule fois sur le total.

## Libellé personnalisé des boutons inline (`|`)

Libellé optionnel après `|` :

```text
[str +5|taper fort]
[pdmg 10 2d4|rafale]
```

Le **texte du bouton** utilise le libellé ; le jet utilise toujours `<type>` et `<formule>`.

## Types de jet (`<type>`)

Insensible à la casse. L’ancienne forme entre crochets `[type:expr]` n’est **pas** prise en charge.

### Jets de caractéristique

Si la formule ne contient **aucun dé**, les jets de stat utilisent par défaut `1d20` avant d’appliquer les modificateurs.

Alias :

- Constitution : `constitution`, `con`
- Force : `strength`, `str`, `force`, `for`
- Intelligence : `intelligence`, `int`
- Perception : `perception`, `per`
- Social : `social`, `soc`
- Agilité : `agility`, `agi`, `agilité`, `agilite`
- Focus : `focus`, `foc`

### Autres types

- Dégâts physiques : `pdmg`, `dgtp`
- Dégâts magiques : `mdmg`, `dgtm`
- Dégâts bruts : `tdmg`, `dgtb`
- Soin : `heal`, `soin`
- Soin temporaire : `theal`, `soint`
- Mana : `mana`
- Générique : `roll`, `r`

Les boutons **Appliquer** (quand ils existent) utilisent la **feuille active** et les défenses le cas échéant.

## Syntaxe des formules

Formules insensibles à la casse. Les espaces sont ignorés.

### Dés

- `XdY` lance **X** dés à **Y** faces.
- X et Y peuvent être des expressions ; sans parenthèses, `d` se lie à l’atome le plus proche.
- Si une **variable** est immédiatement suivie d’un nombre de dés **sans** parenthèses (ex. `cond4d6`), le parseur interprète le `d` devant le chiffre comme l’opérateur de dés, pas comme partie du nom : `cond` + `4d6`. Utilisez des parenthèses pour mettre le nombre dans la variable : `cond(4)d6`.

Exemples : `2d6+3`, `1d(1d4+2)`, `(1d4)d4`, `cond4d6`.

### Arithmétique

- `+` addition
- `-` soustraction
- `*` multiplication
- `/` division avec quotient **arrondi à l’entier le plus proche** (`Math.round` dans l’implémentation ; règles JavaScript pour les `.5`).
- `\` division avec quotient arrondi **vers −∞** (division entière « vers le bas » ; `Math.floor(a / b)` dans l’implémentation).
- `%` division avec quotient arrondi **vers +∞** (`Math.ceil(a / b)` dans l’implémentation). **`%` n’est pas un modulo** — il n’y a pas d’opérateur de reste.
- `^` puissance (exposant borné en entier dans l’évaluateur ; exposants très grands plafonnés — voir [`src/dice/parser.js`](../../src/dice/parser.js))
- `( … )` parenthèses

**Division par zéro :** pour `/`, `\`, `%`, un diviseur nul donne **`0`** (repli sûr).

**Entier final :** après évaluation de toute l’expression, la valeur du jet est convertie en entier par arrondi **vers zéro** (voir `clampInt` / `clampRollInt` dans le parseur et le roller). Pour un **minimum ou maximum sur tout le total** après la formule, utilisez **`!<` / `!>`** dans la sous-section suivante.

### Comparateurs de réussite et suffixes de bornage du total (`!<` / `!>`)

**Seuils de réussite** (hors jets de stat) : comparent la partie gauche du jet à une cible à droite.

- `<` signifie gauche ≤ droite
- `>` signifie gauche ≥ droite

Exemples : `1d20+3 > 12`, `1d20 < dc`.

**Plancher et plafond sur le total du jet :** les marqueurs **`!<expr`** et **`!>expr`** viennent **après** la formule principale. Ils bornent le **total numérique final** avec un **plancher** ou un **plafond** au sens mathématique habituel :

- **`!<expr`** — le total ne peut pas finir **en dessous** de la valeur entière de `expr` ; s’il serait plus bas, il devient cette borne — comme `total = max(total, borne)`.
- **`!>expr`** — le total ne peut pas finir **au-dessus** de la valeur entière de `expr` ; s’il serait plus haut, il devient cette borne — comme `total = min(total, borne)`.

Ce n’est **pas** la même chose que les opérateurs `\` ou **`%` dans la formule** (ceux-ci ne font qu’arrondir une division interne). Si vous enchaînez plusieurs suffixes de bornage, le **plus à droite est retiré en premier** à l’analyse. Chaque expression de borne utilise le **même contexte de variables** que le jet (mêmes variables de feuille, etc.).

Exemples :

```text
[r 1d20+2!<con]
/roll 1d8+1!>6
```

### Variables (feuille active)

Les identifiants sont résolus depuis la **feuille de personnage active**. Un nom inconnu vaut **0**.

#### Totaux de caractéristiques

`con`, `str`, `for`, `int`, `per`, `soc`, `agi`, `foc`

#### PV

- Max : `maxhp`, `hpmax`, `pvmax`, `maxpv`
- Actuels : `curhp`, `hpcur`, `pvact`, `actpv`
- Temporaires : `temhp`, `hptem`, `pvtem`, `tempv`, `temphp`, `hptemp`, `temppv`, `pvtemp`

#### PM

- Max : `maxmp`, `mpmax`, `pmmax`, `maxpm`
- Actuels : `curmp`, `mpcur`, `pmact`, `actpm`

#### Faveur

- Max : `maxfav`, `favmax`
- Actuelle : `curfav`, `favcur`, `favact`, `actfav`

#### Autre

- Nombre d’actions : `act`
- Niveau : `lvl`, `niv`
- Défense physique : `pdef`, `defp`
- Défense magique : `mdef`, `defm`
- Modificateur d’action : `bonact`, `actbon`
- Modificateur de vitesse : `bonspe`, `spebon`, `vitbon`, `bonvit`

## Affichage des multi-jets

- L’interface liste les résultats séparés par `|`.
- Une ligne **Total** additionne les valeurs numériques le cas échéant.
- Les résultats de dés sont regroupés par sous-jet.
