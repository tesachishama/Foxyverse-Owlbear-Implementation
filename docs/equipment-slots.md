# Equipment slots syntax (Inventory)

This document describes the **equipment-slot expression syntax** implemented by the plugin for inventory items (weapons and armor).

The expression defines which equipment slot(s) an item **may** occupy and, when equipped, which slot(s) it **does** occupy.

Implementation: [`src/data/equipSlots.js`](../src/data/equipSlots.js).

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

- `[weapons]` (`[armes]`): `weapon1`, `weapon2`, `weapon3`
- `[head]` (`[tête]`): `hat`, `face`
- `[necklace]` (`[collier]`): `pendant1`, `pendant2`, `pendant3`
- `[upper]` (`[haut]`): `torso`, `rshoulder`, `lshoulder`, `rarm`, `larm`, `rwrist`, `lwrist`, all finger slots
- `[shoulders]` (`[epaules]`): `rshoulder`, `lshoulder`
- `[arms]` (`[bras]`): `rarm`, `larm`
- `[wrists]` (`[poignets]`): `rwrist`, `lwrist`
- `[fingers]` (`[doigts]`): all finger slots (right + left)
- `[rfingers]` (`[doigtsd]`): right-hand fingers
- `[lfingers]` (`[doigtsg]`): left-hand fingers
- `[lower]` (`[bas]`): `belt`, `rleg`, `lleg`, `rankle`, `lankle`, `rfoot`, `lfoot`
- `[legs]` (`[jambes]`): `rleg`, `lleg`
- `[ankles]` (`[chevilles]`): `rankle`, `lankle`
- `[feet]` (`[pieds]`): `rfoot`, `lfoot`
- `[fullrarm]` (`[brasdcomplet]`): `rshoulder`, `rarm`
- `[fulllarm]` (`[brasgcomplet]`): `lshoulder`, `larm`
- `[fullrleg]` (`[jambedcomplete]`): `rleg`, `rfoot`
- `[fulllleg]` (`[jambegcomplete]`): `lleg`, `lfoot`

## Operators

### AND (`&`, `+`, `AND`)

Requires multiple slots simultaneously (occupies all of them).

Example: `hat & pendant1` → must occupy `hat` **and** `pendant1`.

### OR (`|`, `OR`)

Provides alternatives.

Example: `hat | face` → may occupy `hat` **or** `face`.

### Quantity (`*`)

Applies to a **group** and means “choose N distinct slots from the group”.

Example: `[fingers]*2` → occupies any 2 distinct finger slots.

Special value: `[head]*all` → occupies **all** slots in the group (`hat` and `face`).

### Parentheses (`( ... )`)

Controls precedence.

Example: `hat + (pendant1 | pendant2)` → occupies `hat` and either `pendant1` or `pendant2`.

### Exclusion (`-`)

Removes slots from a group before further evaluation.

Example: `[fingers] - (rthumb | lthumb)` → any finger slot except the thumbs.

## Precedence (evaluation order)

From highest to lowest:

1. Parentheses `( ... )`
2. Quantity `*`
3. Exclusion `-`
4. AND (`+`, `&`, `AND`)
5. OR (`|`, `OR`)

## UI behavior (dropdown generation)

Given an item’s expression, the plugin generates dropdown options:

- **Unequipped** (always)
- Each computed equip option (as a human-readable `slot + slot + ...` string)
- **Other** (always; represents equipping to the special `other` slot)

### Disabled options

If an equip option would occupy any **non-`other`** slot already occupied by another item, that option is:

- shown but **disabled**
- visually greyed
- sorted to the bottom of the dropdown

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

When unequipped: `null` (or missing `equippedSlots`).

## Examples

- `hat + pendant1`  
  Options: `hat + pendant1`, `other`

- `hat | face`  
  Options: `hat`, `face`, `other`

- `[necklace]*2`  
  Options: `pendant1 + pendant2`, `pendant1 + pendant3`, `pendant2 + pendant3`, `other`

- `(hat + [necklace]) | (face + [necklace]*2)`  
  Options: `hat + pendant1`, `hat + pendant2`, `hat + pendant3`, `face + pendant1 + pendant2`, `face + pendant1 + pendant3`, `face + pendant2 + pendant3`, `other`
