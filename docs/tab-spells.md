# Spells tab

[Français (FR)](fr/tab-spells.md)

Manage the character’s **spell list**: names, effects, costs, flags, usage counter, and casting (**USE**).

## Who can edit

Add/remove spells, drag reorder, edit fields, and USE require **edit** permission on the sheet.

## Spell list UI

Each spell is a row with:

- **Reorder handle** — drag to change order (persists to the database).
- **Name** — click the row chevron to expand details; edit mode uses a text field.
- **USE** — pays the spell’s **cost** from MP or HP (see below), then increments the **used** counter.
- **Chevron** — expand or collapse details.

## Expanded details

- **Effect** — free text; in view mode, the same rich rendering as chat can show **inline roll buttons** (see [Rolls and inline buttons](rolls-and-inline.md)).
- **Cost** — numeric cost with **MP** vs **HP** toggle when editing.
- **Armed** / **Continuous** — toggles for your table rules (stored on the spell row).
- **Used** — `+` / `−` adjust how many times the spell has been used (debounced save).

## Casting (USE)

- **MP cost** — deducts MP if enough; if MP is short, the app may prompt to cover the remainder with HP (normal characters).
- **HP cost** — deducts HP with confirmation if the cast would be dangerous.
- **Elemental characters** (see [Settings](tab-settings.md)): spells that would cost **HP** are paid from **MP** instead so casting remains usable with max HP 1.

## Add / remove

- **+** — add a new spell.
- **−** — remove a spell (modal to pick which row if needed).

## Database

Spells are stored in the `spell` table per sheet. Optional **element** label may exist if your database migration added it.
