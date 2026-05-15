# Foxyverse Owlbear extension — codebase guide

[Français (FR)](fr/CODEBASE.md)

This document is the **onboarding map** for developers. It explains **what each major part of the code does**, **how data flows**, and **where to look** when you need to change behavior. The [`src/app.js`](../src/app.js) file uses **section banners** that point to the anchors below (`See docs/CODEBASE.md#…`).

**Related user-facing docs:** [database.md](database.md), [rolls-and-inline.md](rolls-and-inline.md), [equipment-slots.md](equipment-slots.md), tab docs under [docs/](.).

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [Bootstrap and entry](#bootstrap-and-entry)
3. [Global state](#global-state)
4. [Permissions and sheet visibility](#permissions-and-sheet-visibility)
5. [Room and sheet loading](#room-and-sheet-loading)
6. [Saving and mutations](#saving-and-mutations)
7. [Dice and rolls](#dice-and-rolls)
8. [Rich text, notes, and inline roll buttons](#rich-text-notes-and-inline-roll-buttons)
9. [Rendering: shell, tabs, and theme](#rendering-shell-tabs-and-theme)
10. [Per-tab UI](#per-tab-ui)
11. [Modals and roll prep](#modals-and-roll-prep)
12. [Event binding (`bindEvents`)](#event-binding-bindevents)
13. [Chat persistence and realtime](#chat-persistence-and-realtime)
14. [Room metadata, party, and field locks](#room-metadata-party-and-field-locks)
15. [Supporting modules](#supporting-modules)
16. [Build and manifest](#build-and-manifest)
17. [Legacy and backward compatibility](#legacy-and-backward-compatibility)

---

## Repository layout

| Path | Role |
|------|------|
| [`src/main.js`](../src/main.js) | Owlbear `OBR.onReady` → calls `initApp()`. |
| [`src/app.js`](../src/app.js) | **Entire UI**: `state`, render functions, DOM events, subscriptions. |
| [`src/style.css`](../src/style.css) | Global styles (large). |
| [`src/dice/parser.js`](../src/dice/parser.js) | Formula lexer/evaluator for roll math. |
| [`src/dice/roller.js`](../src/dice/roller.js) | Roll kinds, parsing `/` commands and `[inline]` buttons, apply damage/heal to sheet. |
| [`src/data/schema.js`](../src/data/schema.js) | In-memory **sheet shape**: defaults, stat math, slot IDs, helpers. |
| [`src/data/storage.js`](../src/data/storage.js) | **Supabase** I/O: fetch/assemble sheet, persist rows, chat, Realtime subscriptions. |
| [`src/data/supabase.js`](../src/data/supabase.js) | Single `createClient` from `VITE_*` env vars. |
| [`src/data/equipSlots.js`](../src/data/equipSlots.js) | Equipment **slot expression** language (separate from dice formulas). |
| [`src/utils/textNormalize.js`](../src/utils/textNormalize.js) | Shared string normalization (diacritics, keys) for dice and slot parsers. |
| [`src/i18n/translations.js`](../src/i18n/translations.js) | Locale strings and `t()`. |
| [`scripts/rewrite-manifest.js`](../scripts/rewrite-manifest.js) | Post-build manifest URL fix for hosting. |

---

## Bootstrap and entry

**Anchor:** `#bootstrap-and-entry`

Owlbear loads the extension iframe; [`src/main.js`](../src/main.js) waits for `OBR.onReady`, imports CSS, then `initApp()` from [`src/app.js`](../src/app.js). If initialization throws, the error is logged and the UI may show `state.startupError`.

`initApp` (near the **bottom** of `app.js`) is the **wiring hub**: it loads room metadata and sheets, hydrates chat, attaches **Supabase Realtime** listeners, subscribes to **chat** changes, and registers **Owlbear** listeners for room metadata and party changes.

---

## Global state

**Anchor:** `#global-state`

The object `state` (declared early in [`src/app.js`](../src/app.js)) is the **single source of truth** for the UI. There is no external framework: after almost any user action, code updates `state` and calls `render()`, which replaces the DOM under `#app` and re-binds events via `bindEvents()`.

Important fields (non-exhaustive):

- **`roomId`, `sheetIds`, `sheetNames`, `permissions`, `tokenToSheet`** — room-level data from Owlbear metadata + storage.
- **`activeSheetId`, `sheet`** — which character is open and its full in-memory object.
- **`activeTab`** — one of `bio` \| `stats` \| `spells` \| `inventory` \| `chat` \| `notes` \| `settings`.
- **`chatMessages`** — recent chat rows mapped for UI.
- **Modal / draft flags** — e.g. `rollModalOpen`, `rollPrepOpen`, `confirmModal`, spell/item edit drafts, currency modals.
- **`isEditingField`, `_realtimePendingAfterEdit`** — avoid clobbering the user while typing or while Realtime fires during an edit.

---

## Permissions and sheet visibility

**Anchor:** `#permissions-and-sheet-visibility`

- **`canView(sheetId)`** — GM sees everything; players need `permissions[playerId].view` to include the sheet id.
- **`canEdit(sheetId)`** — same pattern with `.edit`.
- **`getVisibleSheets()`** — filters `state.sheetIds` with `canView`.

The settings tab lets the GM assign view/edit lists; values are persisted via [`src/data/storage.js`](../src/data/storage.js) and Owlbear room metadata where applicable.

---

## Room and sheet loading

**Anchor:** `#room-and-sheet-loading`

- **`loadRoomData()`** — reads `roomId`, room metadata (sheet list, names, permissions, player directory, field locks, locale) from storage / Owlbear.
- **`loadSheet(sheetId, options)`** — fetches the sheet from Supabase (through `storage.getSheet`), sets `state.sheet`, merges theme/colors, may clear drafts.

If the active sheet is deleted or permission is revoked, loaders fall back to another visible sheet or clear state.

---

## Saving and mutations

**Anchor:** `#saving-and-mutations`

- **`applySheetMutation(mutator)`** — async path: run mutator on a clone, persist via storage, then assign back to `state.sheet`.
- **`applyLocalMutation(mutator)`** — sync path: mutates `state.sheet` in place (used when a follow-up `storage.update*` call persists a slice of data).
- **`saveSheet()` / debounced helpers** — coalesce writes so rapid input does not spam the network.

Row-level updates go through functions like `storage.updateBio`, `storage.updateStat`, `storage.upsertItem`, etc. The storage layer maps the in-memory `sheet` object to **normalized SQL tables** (see [database.md](database.md)).

**Item `used_slots`:** use **`storage.serializeUsedSlots(sheet, item)`** when persisting equipped slots so the same logic applies as when assembling rows from the DB (prefer `item.usedSlots` when present, otherwise derive from `sheet.equipped`).

---

## Dice and rolls

**Anchor:** `#dice-and-rolls`

- **Parsing:** [`src/dice/roller.js`](../src/dice/roller.js) — `parseChatCommand`, `getInlineButtons`, `executeRoll`, apply helpers (`applyPhysicalDamage`, …).
- **Math:** [`src/dice/parser.js`](../src/dice/parser.js) — `evaluateFormula`, variable context built from the active sheet.

Chat lines starting with `/` are detected in event handlers; the stored message is the **rendered result line**, not the raw command. Inline `[roll …]` buttons are parsed in rich HTML for chat and notes.

---

## Rich text, notes, and inline roll buttons

**Anchor:** `#rich-text-notes-and-inline-roll-buttons`

Functions such as `renderNotesBody`, `renderChatBody`, and markdown-ish helpers turn plain text into HTML with **clickable roll buttons**. Tooltip helpers (`installFvPluginTooltipDelegationOnce`, etc.) show expanded text on hover/focus without nesting interactive elements incorrectly.

---

## Rendering: shell, tabs, and theme

**Anchor:** `#rendering-shell-tabs-and-theme`

- **`render()`** — main paint: preserves scroll snapshots, sets `app.innerHTML` from `renderHeader`, `renderTabs`, `renderTabContent`, modals, then `applyColors()`, `bindEvents()`.
- **`applyColors()`** — copies the active sheet theme (or defaults) to CSS variables on `:root`.
- **`renderHeader` / `renderTabs`** — sheet picker, locale flags, GM/player context.

---

## Per-tab UI

**Anchor:** `#per-tab-ui`

Each tab has a `render*Tab()` function returning an HTML string:

| Function | Responsibility |
|----------|----------------|
| `renderBioTab` | Name, class, level, element, portrait-ish fields. |
| `renderStatsTab` | HP/MP/favor, stats, talents, defenses, radar, roll shortcuts. |
| `renderSpellsTab` | Spell list, costs, drag reorder, USE flows. |
| `renderInventoryTab` | Items by section, equipment slots, currency, item talents. |
| `renderChatTab` | Message list, input, roll integration. |
| `renderNotesTab` | Rich notes editor vs preview. |
| `renderSettingsTab` | Theme, import/export, permissions, token linking. |

`renderTabContent()` switches on `state.activeTab`.

---

## Modals and roll prep

**Anchor:** `#modals-and-roll-prep`

- **Roll result modal** — shows dice breakdown, favor reroll, apply buttons.
- **Roll prep modal** — optional step to attach talents / extra formula before rolling.
- **Confirm modal** — generic async confirm pattern (`openConfirmModal` / `closeConfirmModal`).
- **Remove / transfer modals** — spells, items, consumables, currency.

These read/write modal-specific fields on `state` and call `render()` on open/close.

---

## Event binding (`bindEvents`)

**Anchor:** `#event-binding-bindevents`

`bindEvents()` runs **after every full render**. It attaches listeners to elements inside `#app` (event delegation is used in a few places, but many handlers query specific `data-*` nodes). This pattern avoids stale closures on removed DOM at the cost of re-binding each paint.

Large sections inside `bindEvents` correspond to: header/sheet picker, stats steppers, inventory drag-and-drop, chat send, notes toggles, settings forms, etc.

---

## Chat persistence and realtime

**Anchor:** `#chat-persistence-and-realtime`

- **Insert/update/delete** — `storage.insertChatMessage`, `storage.updateChatMessageBody`, `storage.deleteChatMessage`, plus broadcast helpers for multi-client sync.
- **`subscribeToChat`** — Realtime channel for new messages, deletes, and body patches (e.g. superseding a roll line on favor reroll).

`mapChatRow` / `appendChatMessageIfNew` normalize rows into `state.chatMessages`.

---

## Room metadata, party, and field locks

**Anchor:** `#room-metadata-party-and-field-locks`

- **`OBR.room.onMetadataChange`** — reapplies `tokenToSheet`, `playerDirectory`, `fieldLocks`, locale from `metadata.foxyverse`.
- **`OBR.party.onChange`** — refreshes connected players and persists directory updates.
- **Field locks** — collaborative editing guard: acquire/release lock ids stored in room metadata so two users do not edit the same field name at once.

---

## Supporting modules

**Anchor:** `#supporting-modules`

### `schema.js`

Canonical **defaults** for a new sheet (`createEmptySheet`), stat structure, slot id lists, `evalModifier`, HP/MP caps, defense getters, knowledge tier formatting. This is pure data shape + math helpers — no network.

### `equipSlots.js`

Evaluates **equippable slot expressions** on items (different grammar from dice). Used when rendering inventory and when validating equipment.

### `storage.js`

All **Supabase** access: `getSheet` / `persistSheet`, row updates per table, `assembleSheet` from joined rows, Realtime `subscribeToRoom` / `subscribeToChat`. Also local **sessionStorage** cache helpers for faster reopen.

### `supabase.js`

Throws at import time if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing — fail fast in dev.

### `translations.js`

`setLocale`, `t("key")`, and nested `enterField` for labeled form strings.

---

## Build and manifest

**Anchor:** `#build-and-manifest`

- **`vite build`** outputs `dist/` with hashed assets.
- **`scripts/rewrite-manifest.js`** — rewrites `dist/manifest.json` so `action.icon` and `action.popover` use **absolute HTTPS URLs** (required on GitHub Pages). Stamps `version` with git SHA or time for cache busting.

---

## Legacy and backward compatibility

**Anchor:** `#legacy-and-backward-compatibility`

Do **not** remove these without a **data migration** plan:

- **Sheet fields** `actionModifier` / `speedModifier` in [`schema.js`](../src/data/schema.js) — older sheets may still have values; UI prefers newer bonus fields.
- **Items** may still have a single **`talent`** object; the app normalizes toward **`talents[]`**.
- **Equipment keys** — legacy PascalCase or old slot ids are mapped via `SLOT_LEGACY_TO_CANON` / `canonizeSlotToken` when reading `sheet.equipped` or cached shapes.
- **CSS** may reference a legacy notes textarea id — kept so old HTML snapshots do not break.

When adding features, **prefer the new shapes** in `createEmptySheet` and persistence paths, but keep readers tolerant of old data.
