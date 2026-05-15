# Bio tab

Character identity and level. Data is stored in Supabase (`bio` table, linked to the active sheet).

## Who can edit

Fields are **read-only** if you do not have **edit** permission on the current sheet. Editors see normal text/number inputs.

## Fields

- **Name** — first name (free text).
- **Surname** — family name (free text).
- **Element** — character element or affinity label (free text; not the same as the **Is an elemental** rules flag in Settings).
- **Class** — class or archetype label (free text).
- **Level** — positive integer (minimum 1). Use the numeric field or the up/down arrows. Level feeds derived values on the **Stats** tab (max HP/MP, favor, action base, etc.).

## Sheet context

The Bio tab always reflects the **currently selected character** in the extension. Switching sheets (from the extension header / sheet selector) loads another character’s bio.

## Related

- Formulas and rolls can reference level as `lvl` or `niv` (see [Rolls and inline buttons](rolls-and-inline.md)).
