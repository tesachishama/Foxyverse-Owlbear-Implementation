# Foxyverse Owlbear plugin

Vite-built extension for [Owlbear Rodeo](https://www.owlbear.rodeo/). Character sheets sync via **Supabase** (PostgreSQL + Realtime).

## Setup

1. Clone and install: `npm install`
2. Copy `.env.example` to `.env` (or create `.env`) with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Apply SQL migrations in `supabase/migrations/` as needed (e.g. `spell.element`). Your **`chat`** table should already match what the app expects; see below. Enable **Realtime** on `chat` (and other subscribed tables).
4. Dev: `npm run dev` — load the extension URL in Owlbear’s extension dev tools.
5. Production: `npm run build` — deploy `dist/` (e.g. GitHub Pages); configure the same env vars in CI secrets.

## Chat (room log)

The plugin expects your existing `chat` table columns: **`id`**, **`room_id`**, **`sheet_id`**, **`player_id`**, a **text body** column (default name **`content`**), and **`time_sent`** (timestamp). Override the body column with **`VITE_CHAT_MESSAGE_COLUMN`** in `.env` if yours differs (e.g. `message`). Optional: **`VITE_CHAT_TIME_COLUMN`** if the timestamp column is not `time_sent`. Realtime `INSERT` on `chat` should be enabled.

The client stores only IDs; **player name** and **Name Surname** are resolved at render time from Owlbear party / `playerDirectory` and `sheetNames`.

## Dice: chat commands (`/…`)

Commands start with `/`. The word after `/` is the **roll type**; the rest of the line is the **formula** (see below).

When you send a command, the **command itself is not stored** in chat — only the generated roll result line is saved.

| Command | Meaning |
|--------|---------|
| `/constitution`, `/con` | Constitution stat check. If formula has no dice, defaults to `1d20` (then applies the formula). |
| `/strength`, `/str`, `/force`, `/for` | Strength stat check. |
| `/intelligence`, `/int` | Intelligence stat check. |
| `/perception`, `/per` | Perception stat check. |
| `/social`, `/soc` | Social stat check. |
| `/agility`, `/agi`, `/agilité`, `/agilite` | Agility stat check. |
| `/focus`, `/foc` | Focus stat check. |
| `/physicaldamage`, `/pdmg`, `/degatphysique`, `/dégâtphysique`, `/dgtp` | Physical damage roll (Apply button accounts for defenses). |
| `/magicaldamage`, `/mdmg`, `/degatmagique`, `/dégâtmagique`, `/dgtm` | Magical damage roll. |
| `/truedamage`, `/tdmg` | True damage roll (ignores defenses). |
| `/heal`, `/soin` | Heal roll (Apply adds HP). |
| `/theal`, `/soint` | Temp heal roll (Apply adds temp HP). |
| `/mana` | Mana roll (Apply adds MP). |
| `/roll`, `/r` | Generic roll. |

Stat abbreviations match `src/dice/parser.js`: `str`, `con`, `int`, `per`, `soc`, `agi`, `foc`.

## Dice: formula syntax

Used after the command (chat) or inside inline buttons (notes/chat). Not case sensitive.

- **Dice**: `XdY` rolls X dice with Y faces.\n  - X and/or Y can be expressions when parenthesized: `(1d4)d4`.\n  - Without parentheses, `d` binds to the nearest atoms until the first operator.\n- **Operators**: `+`, `-`, `*`, `/` (round), `\\` (floor), `%` (ceil), `^` (power), parentheses.\n- **Success operators**: `<` means “left <= right”, `>` means “left >= right” (adds a success/failure tag to non-stat rolls).\n- **Whitespace** is ignored.

Implementation reference: [`src/dice/parser.js`](src/dice/parser.js), [`src/dice/roller.js`](src/dice/roller.js).

## Inline roll buttons (notes & chat)

In any text field that renders rich content (chat messages, **Notes preview**), you can embed:

```text
[str +5]
[pdmg 2d6+3]
[roll 1d20+2]
```

Bracket form: `[type formula]` where `type` matches the commands above. Click the rendered button to roll using the **current character sheet**; it posts the roll result line into chat.

## Spells: element field

Each spell row can have an optional **Element** label (stored in `spell.element` in the database). Apply the migration that adds the `element` column if upgrading an existing database.

## License

MIT
