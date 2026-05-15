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

## Clamp suffixes (`!<` / `!>`) — floor and ceiling on the roll total

These tokens appear **after** the main formula. They clamp the **final numeric roll total** using a **floor** or **ceiling** in the usual math sense on that total:

- **`!<expr`** — **floor the total at the bound**: the total cannot end up **below** the integer value of `expr`. If it would be lower, it becomes that value — same as `total = max(total, bound)`.
- **`!>expr`** — **ceiling the total at the bound**: the total cannot end up **above** the integer value of `expr`. If it would be higher, it becomes that value — same as `total = min(total, bound)`.

This is **not** the same as the `\` or `%` **operators inside the formula** (those only change how an inner division is rounded).

If you chain several suffixes, **rightmost is stripped first** when parsing. Each bound expression uses the **same variable context** as the roll (same sheet variables, etc.).

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
- `/` division with **nearest-integer** quotient (`Math.round` in the implementation; JavaScript `.5` rules apply).
- `\` division with quotient rounded **toward −∞** (integer division “down”; `Math.floor(a / b)` in the implementation).
- `%` division with quotient rounded **toward +∞** (`Math.ceil(a / b)` in the implementation). **`%` is not modulo** — there is no remainder operator.
- `^` power (exponent is integer-clamped in the evaluator; very large exponents are capped—see [`src/dice/parser.js`](../src/dice/parser.js))
- `( … )` parentheses

**Division by zero:** any of `/`, `\`, `%` with a zero divisor yields **`0`** (safe fallback).

**Final integer:** after the full expression is evaluated, the roll value is coerced to an integer using **toward-zero** rounding (see `clampInt` / `clampRollInt` in the parser and roller). For **minimum/maximum bounds on the whole total** after the formula, use the **`!<` / `!>` clamp suffixes** above (those are an explicit **floor** / **ceiling** on the result).

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
