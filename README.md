# Foxyverse Owlbear extension

[Français (FR)](README.fr.md)

**Foxyverse** is a character-sheet extension for [Owlbear Rodeo](https://www.owlbear.rodeo/). Open it from the map sidebar: each player (or the GM) can attach **character sheets** that stay in sync through **Supabase** (PostgreSQL + Realtime). Tabs cover bio, stats, spells, inventory, shared chat, notes, and settings (themes, permissions, import/export).

- **Developer guide (code map):** [docs/CODEBASE.md](docs/CODEBASE.md) · [FR](docs/fr/CODEBASE.md)  
- **Fork / database / env vars:** [docs/database.md](docs/database.md) · [FR](docs/fr/database.md)  
- **Dice (chat + inline):** [docs/rolls-and-inline.md](docs/rolls-and-inline.md) · [FR](docs/fr/rolls-and-inline.md)  
- **Equipment slot expressions:** [docs/equipment-slots.md](docs/equipment-slots.md) · [FR](docs/fr/equipment-slots.md)

## Documentation index

| Doc | Description | FR |
|-----|-------------|-----|
| [docs/CODEBASE.md](docs/CODEBASE.md) | Developer guide: app structure, data flow, legacy notes | [FR](docs/fr/CODEBASE.md) |
| [docs/tab-bio.md](docs/tab-bio.md) | Bio tab — identity fields and level | [FR](docs/fr/tab-bio.md) |
| [docs/tab-stats.md](docs/tab-stats.md) | Stats tab — HP/MP/favor, actions, defenses, radar, talents | [FR](docs/fr/tab-stats.md) |
| [docs/tab-spells.md](docs/tab-spells.md) | Spells tab — list, costs, USE, reorder | [FR](docs/fr/tab-spells.md) |
| [docs/tab-inventory.md](docs/tab-inventory.md) | Inventory tab — gear, slots, currency, item talents | [FR](docs/fr/tab-inventory.md) |
| [docs/tab-chat.md](docs/tab-chat.md) | Chat tab — room log, rolls, delete rules | [FR](docs/fr/tab-chat.md) |
| [docs/tab-notes.md](docs/tab-notes.md) | Notes tab — rich notes and inline rolls | [FR](docs/fr/tab-notes.md) |
| [docs/tab-settings.md](docs/tab-settings.md) | Settings tab — theme, toggles, permissions, import/export | [FR](docs/fr/tab-settings.md) |
| [docs/equipment-slots.md](docs/equipment-slots.md) | Equipment slot expression language | [FR](docs/fr/equipment-slots.md) |
| [docs/rolls-and-inline.md](docs/rolls-and-inline.md) | Roll commands, inline buttons, formula variables, comparators, `!<`/`!>` | [FR](docs/fr/rolls-and-inline.md) |
| [docs/database.md](docs/database.md) | Supabase schema overview, Realtime, env vars, forking | [FR](docs/fr/database.md) |
| [docs/DB_SCHEMA.sql](docs/DB_SCHEMA.sql) | Reference DDL (not a runnable migration script) | — |

## Install in Owlbear Rodeo

### Use a hosted build (e.g. GitHub Pages)

1. Build and deploy the `dist/` folder so **`manifest.json`** and **`index.html`** are served under a stable HTTPS URL.  
   This repository’s production build uses base path `/Foxyverse-Owlbear-Implementation/` (see [`vite.config.js`](vite.config.js)); a fork must change `base` to match its own hosting URL.
2. In Owlbear Rodeo, open your room → **Extensions** (or the extensions panel for your account, depending on Owlbear version).
3. **Add extension** and paste the **full URL to `manifest.json`**, for example:  
   `https://<your-account>.github.io/<your-repo>/manifest.json`
   for this version it would be:
   `https://tesachishama.github.io/Foxyverse-Owlbear-Implementation/manifest.json` 
   If the UI asks for a “root” URL instead, use the folder that contains both `manifest.json` and `index.html`.

### Local development

1. `npm install`
2. Copy [`.env.example`](.env.example) to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [docs/database.md](docs/database.md)).
3. `npm run dev` and load the **Vite dev server URL** in Owlbear’s extension developer / “load unpacked URL” flow (same idea: Owlbear must reach your machine).

## Minimal developer commands

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

Production builds also run `scripts/rewrite-manifest.js` (see `package.json`).

## License

MIT
