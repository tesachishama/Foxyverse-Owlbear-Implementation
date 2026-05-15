# Settings tab

[Français (FR)](fr/tab-settings.md)

Per-sheet **UI theme**, **import/export**, **optional GM tools**, **permissions**, and **behavior toggles**.

## Who can edit

Theme color pickers, toggles, and sheet import require **edit** on the active sheet. **Sheet permissions** and **import/export everything** are **GM-only** sections.

## UI colors

Three color inputs (**background**, **border/UI**, **text**) define the sheet chrome inside the extension. **Reset** restores defaults when editable.

## Toggles (same row)

- **Auto quick roll** — when on, a normal click on a talent uses the quick roll path; **Shift+click** opens the roll prep modal (behavior is inverted when off). Tooltip on the Stats speed button reflects the mode.
- **Is an elemental** — enables elemental rules (max HP 1, special max MP, physical damage fully absorbed in apply logic, magical/true damage interacts with temp HP then mana, HP-cost spells paid from MP, etc.). Turning on clamps current HP to max and current MP to max MP; temp HP is **not** cleared.

## Import / export (sheet)

- **Export sheet** — download the active character as JSON (local backup or move to another room after manual import elsewhere).
- **Import sheet** — replace the active sheet from a JSON file (destructive; confirm in-app).

## GM-only blocks

- **Sheet permissions** — for each party member (except the GM row), toggle **can see** and **can edit** for the **current** sheet.
- **Import everything / Export everything** — bulk room data for advanced backup/migration (use with care).

## Related

- [Database](database.md) — where `is_elemental`, `auto_quick_roll`, theme columns, and permissions live.
