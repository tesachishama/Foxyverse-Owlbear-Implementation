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

Commands start with `/`. The word after `/` is the **roll type**; the rest of the line is the **expression** (see below).

| Command | Meaning |
|--------|---------|
| `/str`, `/con`, `/int`, `/per`, `/soc`, `/agi`, `/foc` | Stat check vs DC = your **total** for that stat. Expression is the modifier to the d20 (e.g. `/str +5`). |
| `/roll` | Generic roll; expression only (e.g. `/roll 2d6+3`). |
| `/pdmg` | Physical damage roll (expression). Can apply from the result modal where supported. |
| `/mdmg` | Magic damage roll. |
| `/tdmg` | True damage roll. |
| `/heal` | Heal roll. |
| `/theal` | Over-heal (temp HP) roll. |

Stat abbreviations match `src/dice/parser.js`: `str`, `con`, `int`, `per`, `soc`, `agi`, `foc`.

## Dice: expression syntax

Used after the command (chat) or inside inline buttons (notes/chat):

- **Dice:** `NdX` (e.g. `2d6`, `1d20`). `Nd` with stat face: `2dper` uses your Perception total as die size (see parser).
- **Stats in math:** `str`, `con`, etc. as values in expressions.
- **Operators:** `+`, `-`, `*`, `/`, parentheses.
- Whitespace is ignored in the parser’s tokenizer.

Implementation reference: [`src/dice/parser.js`](src/dice/parser.js), [`src/dice/roller.js`](src/dice/roller.js).

## Inline roll buttons (notes & chat)

In any text field that renders rich content (chat messages, **Notes preview**), you can embed:

```text
[str:+5]
[pdmg:2d6+3]
[roll:1d20+2]
```

Bracket form: `[type:expression]` where `type` is one of: `str`, `con`, `int`, `per`, `soc`, `agi`, `foc`, `pdmg`, `mdmg`, `tdmg`, `heal`, `theal`, `roll` (also `statroll` as alias in code). Click the rendered button to roll using the **current character sheet**.

## Spells: element field

Each spell row can have an optional **Element** label (stored in `spell.element` in the database). Apply the migration that adds the `element` column if upgrading an existing database.

## License

MIT
