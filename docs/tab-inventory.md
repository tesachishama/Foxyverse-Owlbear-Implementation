# Inventory tab

[Français (FR)](fr/tab-inventory.md)

Equipment, consumables, bags, loose items, **currency**, and **item transfer**. Item stats and **equipment slot expressions** feed the **Stats** tab (defenses, passive bonuses from gear).

## Who can edit

Adding/removing items, editing fields, equipping, and currency actions require **edit** permission on the sheet.

## Equipment diagram

The **silhouette** shows canonical slots (weapons, armor, jewelry, etc.). Click a slot (or linked item) to focus inventory rows. Items equipped in the diagram occupy the slots defined by their **usable slot** expression.

## Sections

Typical groups (depending on what the character owns):

- **Equipped** / **Weapons** / **Armor** — attack and defense gear; each item can have stat bonuses, physical/magical defense, weapon slot count, and an **equipment slots** expression.
- **Consumables**, **Others**, **Bags** — quantity and descriptions; bags may hold nested content per your data model.

## Equipping

Each equippable item has a **dropdown** of valid placements generated from its slot expression, plus **Unequipped** and **Other**. Conflicting real slots are shown disabled. Syntax is documented in [Equipment slots](equipment-slots.md).

## Item card actions

Depending on item type: edit name/description/stats, defenses, slot expression, **talent** row (add/edit/remove a talent bound to that weapon or armor), transfer to another character, etc.

## Currency

Gold / silver / copper with add/remove/transfer flows (modals). Persisted per sheet.

## Related

- [Equipment slots](equipment-slots.md) — full expression language.
- [Stats tab](tab-stats.md) — defenses and bonuses from items.
