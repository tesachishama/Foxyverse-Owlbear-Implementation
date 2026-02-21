# Foxyverse — Owlbear Rodeo plugin

An [Owlbear Rodeo](https://www.owlbear.rodeo/) extension for the **Foxyverse** homebrew TTRPG: d20 stat checks (DC = stat value), character sheets, spells, inventory, chat, and dice rolls with inline buttons.

## Features

- **Character sheets** — Dropdown at top; GM can create/edit all; permissions (view/edit) per player in Settings; sheet list and permissions in room metadata, full data in localStorage (persists across sessions).
- **Language** — EN/FR flags; all UI strings in `src/i18n/translations.js` (edit that file to translate).
- **Tabs**: Bio, Stats, Spells, Inventory, Chat, Notes, Settings.

### Bio
- Name, Surname, Element, Class, Level.

### Stats
- Temp HP, Current/Max HP (Max = Constitution×2), Current/Max MP (Max = Round((Int+Focus)×0.75)), Current/Max Favor (Max = RoundUp((Level+1)/3)), Action count, Speed formula.
- Seven stats: Constitution, Strength, Intelligence, Perception, Social, Agility, Focus (Base, XP Bonus, Item Bonus, Passive Bonus, Total).
- Per-stat **Roll** button: optional modifier (+/- or quick -10,-5,-3,-1,+1,+3,+5,+10), then 1d20 vs DC = stat total; **Nat 1** / **Nat 20** and success/failure.
- **Knowledge** list: add/remove, tier 1–4 (+1/+3/+5/+10), toggle on/off.

### Spells
- Add/remove/reorder; Name, Effect (supports inline roll buttons), Cost (HP or MP), “Deduct cost” with MP→HP overflow and confirmation.

### Inventory
- Sections: Consumables, Others, Weapons, Armor, Bags. Add/remove items; name, qty, description (inline buttons). Defense/Magical Defense from equipped armor used for damage application. (Full slot-based equip UI with all body slots can be added later.)

### Dice
- **Stat roll**: 1d20 + modifier, DC = stat; success = roll ≤ DC (Nat 1 fail, Nat 20 success).
- **Other rolls**: `[pdmg:2d6+3]`, `[mdmg:1d8]`, `[tdmg:2dper+(str/2)]`, `[heal:2d10]`, `[theal:1d4*4]`, `[roll:1d100]`. Left-to-right math; stat refs: str, con, int, per, soc, agi, foc (e.g. `2dper` = 2 dice with faces = Perception total).
- **Chat commands**: `/str +5`, `/pdmg 2d6+3`, `/mdmg 1d8`, `/heal 2d10`, `/roll 1d20`.
- Roll result modal: **Apply** for Physical/Magic/True damage (minus Defense/Magical Defense), Heal (cap at max HP), Over-heal (temp HP). **Reroll** costs 1 Favor.

### Chat
- Live messages via broadcast; roll feedback; history stored in localStorage per room (between sessions).

### Notes
- Plain text, saved with the sheet.

### Settings
- **UI colors**: 5 color pickers (background, surface, border, text, accent).
- **Permissions** (GM only): per sheet, give each player View and/or Edit.
- **Export / Import** sheet as JSON file.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

In Owlbear Rodeo: **Settings** → **Extensions** → **Add Extension** → manifest URL (use a tunnel to your dev server or `npx serve dist -p 4173` and `http://localhost:4173/manifest.json` for local test).

## Build

```bash
npm run build
```

Output in `dist/`. The repo’s GitHub Action deploys to **GitHub Pages**. Extension URL:

- `https://<your-username>.github.io/Foxyverse-Owlbear-Implementation/manifest.json`

## Project layout

- `public/manifest.json`, `public/icon.svg` — Extension manifest and icon.
- `src/main.js` — Entry (`OBR.onReady`).
- `src/app.js` — Main UI and state.
- `src/i18n/translations.js` — **Single file for all UI strings** (EN + FR); change here to translate.
- `src/data/schema.js` — Sheet shape, stats, slots, formulas.
- `src/data/storage.js` — Room metadata, localStorage, broadcast.
- `src/dice/parser.js` — Dice expression tokenize/evaluate, stat refs.
- `src/dice/roller.js` — Roll types, inline/chat parsing, apply damage/heal.
- `src/style.css` — Styles (uses CSS variables for the 5 theme colors).

Docs: [Owlbear Rodeo Extensions](https://docs.owlbear.rodeo/extensions/getting-started/).
