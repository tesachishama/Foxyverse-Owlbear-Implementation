# Database and self-hosting (Supabase)

[Français (FR)](fr/database.md)

The extension is a **static Vite app** that talks to **Supabase** (PostgreSQL + Realtime) using the **anon key** in the browser. There is no separate custom backend in this repository.

Operator overview: [DB_SCHEMA.sql](DB_SCHEMA.sql) (reference DDL). For day-to-day fork setup, read this file and [`.env.example`](../.env.example).

## Environment variables

Defined at build time (`import.meta.env`). Set them in `.env` locally and in CI secrets for production builds (see [.github/workflows/main.yml](../.github/workflows/main.yml)).

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (`https://xxx.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase **anon** public key (client-side). |
| `VITE_CHAT_MESSAGE_COLUMN` | No | Chat table column for message body. Default: `content`. |
| `VITE_CHAT_TIME_COLUMN` | No | Chat table column for timestamp. Default: `time_sent`. |

Sanitization of optional column names is applied in [`src/data/storage.js`](../src/data/storage.js); invalid identifiers fall back to defaults.

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, the client throws at startup ([`src/data/supabase.js`](../src/data/supabase.js)).

## Chat table shape

The app expects a `chat` row to include at least:

- `id`, `room_id`, `sheet_id`, `player_id`
- A text body column (default name **`content`**, overridable via `VITE_CHAT_MESSAGE_COLUMN`)
- A timestamp column (default **`time_sent`**, overridable via `VITE_CHAT_TIME_COLUMN`)

Enable **Supabase Realtime** for `chat` (INSERT, and UPDATE/DELETE if you use edit/delete). The client also uses **broadcast** events on the same channel for delete/update fan-out when needed.

## Realtime: what the client subscribes to

### Room channel (`subscribeToRoom`)

Postgres changes on these tables (filtered so events belong to the current Owlbear **room** id):

- `sheet`
- `sheet_permissions`
- `bio`
- `stat`
- `talent` (sheet-bound and item-bound rows; item events are correlated to the sheet via item ownership)
- `spell`
- `currency`
- `item`

### Chat channel (`subscribeToChat`)

- `chat`: INSERT, DELETE, UPDATE (when body update handler is used)
- Broadcast: `chat_deleted`, `chat_updated`

## Tables (logical overview)

Align columns with [DB_SCHEMA.sql](DB_SCHEMA.sql). Typical layout:

| Table | Role |
|-------|------|
| `room` | One row per Owlbear room id using the extension. |
| `sheet` | Core sheet row: HP/MP/favor, theme colors, notes, flags (`is_elemental`, `auto_quick_roll`), timestamps. |
| `bio` | Name, surname, element, class, level (1:1 with `sheet`). |
| `stat` | One row per stat per sheet (`base`, `passive`). |
| `talent` | Either **sheet** talents (`sheet_id` set, `item_id` null) or **item** talents (`item_id` set, `sheet_id` null); XOR enforced. |
| `spell` | Spell list per sheet; optional `element` column (see migrations). |
| `item` | Weapons, armor, consumables, bags, other; `usable_slots` / `used_slots` JSONB; stat/defense bonuses. |
| `currency` | Gold / silver / copper per sheet. |
| `sheet_permissions` | Per-player view/edit flags per sheet. |
| `chat` | Room chat log lines (roll results, system lines, etc.). |

## Migrations

SQL snippets that alter an existing project live under [`supabase/migrations/`](../supabase/migrations/). Example: optional `spell.element` text column.

If you import an older database dump, compare it to [DB_SCHEMA.sql](DB_SCHEMA.sql) and apply any missing columns or constraints before running a build against that project.

## Row Level Security (RLS)

This repository does **not** ship a full set of RLS policies. Forks must configure Supabase **RLS** (and optionally **Realtime publication**) so that:

- Players in a room can read/write only the data you intend (often permissive anon policies for a private playtest; stricter policies for production).

Consult [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security). Test with the anon key in the browser as your players will.

## Hosting the extension (forks)

1. Create a Supabase project, apply schema + migrations, configure RLS and Realtime.
2. Set GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see workflow file).
3. Adjust [`vite.config.js`](../vite.config.js) **`base`** to match where you host `dist/` (e.g. GitHub Pages path `/<repo>/`). The built `index.html` and `manifest.json` must resolve under that base.
4. `npm run build` deploys artifacts; Owlbear loads your hosted extension URL (see root [README.md](../README.md)).

## Reference exports

If you compare against an external SQL export (e.g. from Supabase dashboard), expect ordering and minor column differences. Treat **this repo’s** `docs/DB_SCHEMA.sql` plus `supabase/migrations/` as the source of truth for the **current** app code in [`src/data/storage.js`](../src/data/storage.js).
