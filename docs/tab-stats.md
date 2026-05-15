# Stats tab

Combat resources, derived stats, defenses, the **radar** chart, and **talents** (including talents granted by equipped items).

## Who can edit

Steppers and talent actions respect **edit** permission on the active sheet. Read-only users see the same numbers but cannot change them.

## Health block

- **Maximum** — read-only; computed from constitution, level, and whether the sheet is **elemental** (elementals have max HP 1).
- **Current** — current hit points (editable within valid range).
- **Temporary** — temporary HP (editable). For **elementals**, magical/true damage applies to temp HP first, then overflow drains **mana**; current HP is not reduced by that damage (see Settings / elemental rules).

## Mana and Favor

- **Mana** — max (computed from stats and level, with an elemental-specific max MP formula when applicable) and current MP stepper.
- **Favor** — max and current; used for favor-based rerolls in the roll modal.

## Actions and speed

- **Actions** — total action count (computed base + bonus stepper).
- **Speed** — roll button uses the displayed formula; bonus stepper adjusts the modifier part.

## Defences

- **Physical** and **magical** totals from equipped armor (read-only pills). Elementals show **infinite** (∞) for physical defense in the UI; magical defense stays numeric.

## Radar and detailed statistics

- **Radar** — visual summary of base stat totals.
- **Detailed statistics** table — per-stat **base** (with level-1 constraints where applicable), **item** bonus (read-only), and **passive** bonus steppers.

## Talents

- **Sheet talents** — from the knowledge/talent list; click a talent to roll (respecting **Auto quick roll** in Settings: normal click vs Shift+click opens roll prep).
- **Item-bound talents** — weapons and armor can carry their own talent; those appear in the grid when the item exists and are visually marked; equipped items’ talents behave like normal talents for rolling.

## Related

- [Rolls and inline buttons](rolls-and-inline.md) — variables such as `maxhp`, `curmp`, `pdef`, `mdef`.
- [Inventory tab](tab-inventory.md) — where defenses and item talents come from.
