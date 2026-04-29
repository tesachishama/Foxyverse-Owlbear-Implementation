# Equipment slots syntax (Inventory)

This document describes the **exact equipment-slot expression syntax** implemented by the plugin for Inventory items.

The expression defines which equipment slot(s) an item **may** occupy and, when equipped, which slot(s) it **does** occupy.

## Concepts

- **Slot**: a single equipment location, written as a bare identifier (e.g. `hat`).
- **Group**: a named set of slots, written in square brackets (e.g. `[head]`).
- **Expression**: combines slots/groups with operators to produce one or more **equip options**.
- **Equip option**: a concrete set of slot IDs (e.g. `hat + pendant2`) that can be selected in the UI dropdown.
- **Special slot: `other`**: unlimited capacity. Any number of items may be equipped to `other`.

## Slot identifiers (canonical) and aliases

All matching is case-insensitive and whitespace-insensitive around operators.

### Weapons
- `weapon1` (`arme1`)
- `weapon2` (`arme2`)
- `weapon3` (`arme3`)

### Head / face
- `hat` (`chapeau`)
- `face` (`visage`)

### Necklace
- `pendant1` (`pendentif1`)
- `pendant2` (`pendentif2`)
- `pendant3` (`pendentif3`)

### Upper body
- `torso` (`torse`)
- `rshoulder` (`epauled`)
- `lshoulder` (`epauleg`)
- `rarm` (`brasd`)
- `larm` (`brasg`)
- `rwrist` (`poignetd`)
- `lwrist` (`poignetg`)

### Right hand fingers
- `rthumb` (`pouced`)
- `rindex` (`indexd`)
- `rmiddle` (`majeurd`)
- `rring` (`annulaired`)
- `rpinky` (`auriculaired`)

### Left hand fingers
- `lthumb` (`pouceg`)
- `lindex` (`indexg`)
- `lmiddle` (`majeurg`)
- `lring` (`annulaireg`)
- `lpinky` (`auriculaireg`)

### Lower body
- `belt` (`ceinture`)
- `rleg` (`jambed`)
- `lleg` (`jambeg`)
- `rankle` (`chevilled`)
- `lankle` (`chevilleg`)
- `rfoot` (`piedd`)
- `lfoot` (`piedg`)

### Special
- `other` (`autre`)

## Groups (canonical) and aliases

Groups expand to the listed canonical slots.

- `[weapons]` (`[armes]`)\n  `weapon1`, `weapon2`, `weapon3`
- `[head]` (`[tête]`)\n  `hat`, `face`
- `[necklace]` (`[collier]`)\n  `pendant1`, `pendant2`, `pendant3`
- `[upper]` (`[haut]`)\n  `torso`, `rshoulder`, `lshoulder`, `rarm`, `larm`, `rwrist`, `lwrist`, `rthumb`, `rindex`, `rmiddle`, `rring`, `rpinky`, `lthumb`, `lindex`, `lmiddle`, `lring`, `lpinky`
- `[shoulders]` (`[epaules]`)\n  `rshoulder`, `lshoulder`
- `[arms]` (`[bras]`)\n  `rarm`, `larm`
- `[wrists]` (`[poignets]`)\n  `rwrist`, `lwrist`
- `[fingers]` (`[doigts]`)\n  all finger slots (right + left)
- `[rfingers]` (`[doigtsd]`)\n  right-hand fingers
- `[lfingers]` (`[doigtsg]`)\n  left-hand fingers
- `[lower]` (`[bas]`)\n  `belt`, `rleg`, `lleg`, `rankle`, `lankle`, `rfoot`, `lfoot`
- `[legs]` (`[jambes]`)\n  `rleg`, `lleg`
- `[ankles]` (`[chevilles]`)\n  `rankle`, `lankle`
- `[feet]` (`[pieds]`)\n  `rfoot`, `lfoot`
- `[fullrarm]` (`[brasdcomplet]`)\n  `rshoulder`, `rarm`
- `[fulllarm]` (`[brasgcomplet]`)\n  `lshoulder`, `larm`
- `[fullrleg]` (`[jambedcomplete]`)\n  `rleg`, `rfoot`
- `[fulllleg]` (`[jambegcomplete]`)\n  `lleg`, `lfoot`

## Operators

### AND (`&`, `+`, `AND`)
Requires multiple slots simultaneously (occupies all of them).

Example:
- `hat & pendant1` → must occupy `hat` **and** `pendant1`.

### OR (`|`, `OR`)
Provides alternatives.

Example:
- `hat | face` → may occupy `hat` **or** `face`.

### Quantity (`*`)
Applies to a **group** and means “choose N distinct slots from the group”.

Example:
- `[fingers]*2` → occupies any 2 distinct finger slots.

Special value:
- `[head]*all` → occupies **all** slots in the group (`hat` and `face`).

### Parentheses (`( ... )`)
Controls precedence.

Example:
- `hat + (pendant1 | pendant2)` → occupies `hat` and either `pendant1` or `pendant2`.

### Exclusion (`-`)
Removes slots from a group before further evaluation.

Example:
- `[fingers] - (rthumb | lthumb)` → any finger slot except the thumbs.

## Precedence (evaluation order)

From highest to lowest:
1. Parentheses `( ... )`
2. Quantity `*`
3. Exclusion `-`
4. AND (`+`, `&`, `AND`)
5. OR (`|`, `OR`)

## UI behavior (dropdown generation)

Given an item’s expression, the plugin generates dropdown options:
- `Unequipped` (always)
- Each computed equip option (as a human-readable `slot + slot + ...` string)
- `Other` (always; represents equipping to the special `other` slot)

### Disabled options
If an equip option would occupy any **non-`other`** slot already occupied by another item, that option is:\n- shown but **disabled**\n- visually greyed\n- sorted to the bottom of the dropdown

## Saved state (DB fields)

### `public.item.usable_slots` (jsonb)
Stores the equippable rule in JSON:

```json
{ "expr": "(hat + [necklace]) | (face + [necklace]*2)" }
```

### `public.item.used_slots` (jsonb)
Stores what the item is currently equipped to, if equipped:

```json
{ "equippedSlots": ["hat", "pendant2"] }
```

Or unequipped:
- `null` (or missing `equippedSlots`)

## Examples

- `hat + pendant1`\n  Options: `hat + pendant1`, `other`

- `hat | face`\n  Options: `hat`, `face`, `other`

- `[necklace]*2`\n  Options: `pendant1 + pendant2`, `pendant1 + pendant3`, `pendant2 + pendant3`, `other`

- `(hat + [necklace]) | (face + [necklace]*2)`\n  Options:\n  - `hat + pendant1`\n  - `hat + pendant2`\n  - `hat + pendant3`\n  - `face + pendant1 + pendant2`\n  - `face + pendant1 + pendant3`\n  - `face + pendant2 + pendant3`\n  - `other`

