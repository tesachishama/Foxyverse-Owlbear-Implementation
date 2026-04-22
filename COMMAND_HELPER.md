# Roll commands & inline buttons helper

This file is a practical reference for how **roll commands** and **inline roll buttons** work, plus a lexicon of everything usable inside a roll **formula**.

## 1) Quick start

### Roll from chat

Type:

```text
/<type> <formula>
```

Examples:

```text
/str +3
/pdmg 2d4+1
/roll 1d20+2
```

The chat message stored in the DB is the **roll result line**, not your original `/command`.

### Roll from notes or chat text (inline buttons)

Write:

```text
[<type> <formula>]
```

Examples:

```text
[str +3]
[pdmg 2d4+1]
[roll 1d20+2]
```

In **view mode**, these render as clickable buttons.
In **notes edit mode**, you see the raw bracket syntax.

## 2) Multi-roll (repeat count)

You can roll multiple times in one go by putting a repeat count as the **first token** of the formula:

```text
/str 5 +3
[str 5 +3]
```

Meaning: do 5 stat rolls, each equivalent to `1d20+3`.

Another example:

```text
/pdmg 10 2d4
[pdmg 10 2d4]
```

Meaning: roll 10 times `2d4`.

Notes:

- Count is clamped to **1..100**.
- Favor reroll rerolls the **whole set** for multi-rolls.
- Damage apply for `pdmg`/`mdmg` applies **defense per roll** (not once on the total).

## 3) Inline button custom label (`|`)

Inline syntax supports an optional label after a `|`:

```text
[str +5|taper fort]
[pdmg 10 2d4|rafale]
```

When present, the **button text** uses the label. The actual roll still uses the parsed `<type>` and `<formula>`.

## 4) Roll types (`<type>`)

### Stat checks

Stat checks default to `1d20` when the formula contains no dice.

Aliases:

- Constitution: `constitution`, `con`
- Strength: `strength`, `str`, `force`, `for`
- Intelligence: `intelligence`, `int`
- Perception: `perception`, `per`
- Social: `social`, `soc`
- Agility: `agility`, `agi`, `agilité`, `agilite`
- Focus: `focus`, `foc`

### Other roll types

- Physical damage: `physicaldamage`, `pdmg`, `degatphysique`, `dégâtphysique`, `dgtp`
- Magical damage: `magicaldamage`, `mdmg`, `degatmagique`, `dégâtmagique`, `dgtm`
- True damage: `truedamage`, `tdmg`
- Heal: `heal`, `soin`
- Temp heal: `theal`, `soint`
- Mana: `mana`
- Generic: `roll`, `r`

## 5) Formula lexicon

Formulas are case-insensitive. Whitespace is ignored.

### Dice

- `XdY` rolls **X** dice with **Y** faces.
- X and Y are expressions; without parentheses, `d` binds to the nearest atom.

Examples:

```text
2d6+3
1d(1d4+2)
(1d4)d4
```

### Arithmetic operators

- `+` add
- `-` subtract
- `*` multiply
- `/` divide (rounded)
- `\` divide (floor)
- `%` divide (ceil)
- `^` power
- `( … )` parentheses

### Success comparators

These annotate non-stat rolls with success/failure:

- `<` means left <= right
- `>` means left >= right

Examples:

```text
1d20+3 > 12
1d20 < dc
```

### Variables (active sheet)

Identifiers resolve from the **active character sheet**. Unknown names resolve to **0**.

#### Stat totals

- `con`
- `str`, `for`
- `int`
- `per`
- `soc`
- `agi`
- `foc`

#### HP

- Max HP: `maxhp`, `hpmax`, `pvmax`, `maxpv`
- Current HP: `curhp`, `hpcur`, `pvact`, `actpv`
- Temp HP: `temhp`, `hptem`, `pvtem`, `tempv`, `temphp`, `hptemp`, `temppv`, `pvtemp`

#### MP

- Max MP: `maxmp`, `mpmax`, `pmmax`, `maxpm`
- Current MP: `curmp`, `mpcur`, `pmact`, `actpm`

#### Favor

- Max favor: `maxfav`, `favmax`
- Current favor: `curfav`, `favcur`, `favact`, `actfav`

#### Other

- Action count: `act`
- Level: `lvl`, `niv`, `level`, `niveau`
- Physical defense: `pdef`, `defp`
- Magical defense: `mdef`, `defm`
- Action modifier: `bonact`, `actbon`
- Speed modifier: `bonspe`, `spebon`, `vitbon`, `bonvit`

## 6) Output notes (multi-roll readability)

For multi-rolls:

- The roll result UI shows individual results separated by `|`.
- A `Total : <sum>` line is displayed.
- Dice results are grouped per singular roll: `[r1... | r2... | r3...]`.

