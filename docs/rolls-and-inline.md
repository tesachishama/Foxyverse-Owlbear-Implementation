# Roll commands and inline buttons

[Français (FR)](fr/rolls-and-inline.md)

How **chat roll commands**, **inline roll buttons**, and **formula** syntax work in the Foxyverse Owlbear extension.

Implementation references:

- [`src/dice/roller.js`](../src/dice/roller.js) — roll types, repeat counts, clamps, apply-to-sheet helpers
- [`src/dice/parser.js`](../src/dice/parser.js) — formula parsing and variable context (`buildFormulaContext`)

## Quick start

### Roll from chat

Type a line starting with `/`, then the **roll type**, then the **formula**:

```text
/<type> <formula>
```

Examples:

```text
/str +3
/pdmg 2d4+1
/roll 1d20+2
```

The message **stored in the database** is the generated **roll result line**, not your original `/command`.

### Roll from notes or chat (inline buttons)

In text that is rendered as rich content (chat messages, **Notes** preview), embed:

```text
[<type> <formula>]
```

Examples:

```text
[str +3]
[pdmg 2d4+1]
[roll 1d20+2]
```

In **view mode**, these render as clickable buttons. In **edit mode**, you see the raw bracket syntax.

## Multi-roll (repeat count)

Put an integer **count** as the **first token** of the formula:

```text
/str 5 +3
[str 5 +3]
```

Meaning: 5 stat rolls, each equivalent to `1d20+3`.

```text
/pdmg 10 2d4
[pdmg 10 2d4]
```

Meaning: 10 rolls of `2d4`.

Rules:

- Count is clamped to **1..100**.
- Favor reroll rerolls the **whole set** for multi-rolls.
- For `pdmg` / `mdmg`, **Apply** uses defense **per roll**, not once on the total.

## Inline custom label (`|`)

Optional label after `|`:

```text
[str +5|hit hard]
[pdmg 10 2d4|full burst]
```

The **button caption** uses the label; the roll still uses `<type>` and `<formula>`.

## Clamp suffixes (after the main formula)

Suffixes apply to the **numeric total after the main formula** is evaluated; **rightmost is stripped first** if you chain several. The bound expressions use the **same variable context** as the roll (same sheet variables, etc.).

- `!<expr` — **minimum floor**: if the roll total is **less** than the value of `expr`, it becomes that value (the total is raised to the floor).
- `!>expr` — **maximum cap**: if the roll total is **greater** than the value of `expr`, it becomes that value (the total is lowered to the ceiling).

Examples:

```text
[r 1d20+2!<con]
/roll 1d8+1!>6
```

## Roll types (`<type>`)

Case-insensitive. Old `[type:expr]` bracket form is **not** supported.

### Stat checks

If the formula contains **no dice**, stat checks default to `1d20` before applying modifiers.

Aliases:

- Constitution: `constitution`, `con`
- Strength: `strength`, `str`, `force`, `for`
- Intelligence: `intelligence`, `int`
- Perception: `perception`, `per`
- Social: `social`, `soc`
- Agility: `agility`, `agi`, `agilité`, `agilite`
- Focus: `focus`, `foc`

### Other roll types

- Physical damage: `pdmg`, `dgtp`
- Magical damage: `mdmg`, `dgtm`
- True damage: `tdmg`, `dgtb`
- Heal: `heal`, `soin`
- Temp heal: `theal`, `soint`
- Mana: `mana`
- Generic: `roll`, `r`

Apply buttons (where available) use the **active character sheet** and defenses where relevant.

## Formula syntax

Formulas are case-insensitive. Whitespace is ignored.

### Dice

- `XdY` rolls **X** dice with **Y** faces.
- X and Y can be expressions; without parentheses, `d` binds to the nearest atom.

Examples: `2d6+3`, `1d(1d4+2)`, `(1d4)d4`.

### Arithmetic

- `+` addition
- `-` subtraction
- `*` multiplication
- `/` **rounded division**: `a / b` uses `Math.round(a / b)` in the implementation (nearest integer, with JavaScript’s usual `.5` behavior).
- `\` **floor division**: `a \ b` is **⌊a ÷ b⌋** (`Math.floor(a / b)`). Use this when you want the quotient rounded **down** (toward −∞ for negatives).
- `%` **ceil division**: `a % b` is **⌈a ÷ b⌉** (`Math.ceil(a / b)`). In this dice language **`%` is always ceil-of-quotient**, not a remainder/modulo operator.
- `^` power (exponent is integer-clamped in the evaluator; very large exponents are capped—see [`src/dice/parser.js`](../src/dice/parser.js))
- `( … )` parentheses

**Division by zero:** any of `/`, `\`, `%` with a zero divisor yields **`0`** (safe fallback).

**Final integer:** after the full expression is evaluated, the roll value is coerced to an integer using **toward-zero** rounding: negative values use `Math.ceil`, non-negative use `Math.floor` (see `clampInt` / `clampRollInt` in the parser and roller).

### Success comparators (non-stat rolls)

- `<` means left ≤ right
- `>` means left ≥ right

Examples: `1d20+3 > 12`, `1d20 < dc`.

### Variables (active sheet)

Identifiers resolve from the **active character sheet**. Unknown names resolve to **0**.

#### Stat totals

`con`, `str`, `for`, `int`, `per`, `soc`, `agi`, `foc`

#### HP

- Max: `maxhp`, `hpmax`, `pvmax`, `maxpv`
- Current: `curhp`, `hpcur`, `pvact`, `actpv`
- Temp: `temhp`, `hptem`, `pvtem`, `tempv`, `temphp`, `hptemp`, `temppv`, `pvtemp`

#### MP

- Max: `maxmp`, `mpmax`, `pmmax`, `maxpm`
- Current: `curmp`, `mpcur`, `pmact`, `actpm`

#### Favor

- Max: `maxfav`, `favmax`
- Current: `curfav`, `favcur`, `favact`, `actfav`

#### Other

- Action count: `act`
- Level: `lvl`, `niv`
- Physical defense: `pdef`, `defp`
- Magical defense: `mdef`, `defm`
- Action modifier: `bonact`, `actbon`
- Speed modifier: `bonspe`, `spebon`, `vitbon`, `bonvit`

## Multi-roll output

- The roll result UI lists individual results separated by `|`.
- A **Total** line sums numeric results where applicable.
- Dice results are grouped per sub-roll.
