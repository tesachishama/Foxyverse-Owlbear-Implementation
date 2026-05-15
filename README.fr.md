# Extension Foxyverse pour Owlbear Rodeo

[English (EN)](README.md)

**Foxyverse** est une extension de **feuilles de personnage** pour [Owlbear Rodeo](https://www.owlbear.rodeo/). Ouvrez-la depuis la barre latérale de la carte : chaque joueur (ou le MJ) peut attacher des **feuilles** synchronisées via **Supabase** (PostgreSQL + Realtime). Les onglets couvrent la bio, les stats, les sorts, l’inventaire, le chat partagé, les notes et les réglages (thèmes, droits, import/export).

- **Guide développeur (carte du code) :** [docs/fr/CODEBASE.md](docs/fr/CODEBASE.md) · [EN](docs/CODEBASE.md)  
- **Fork / base de données / variables d’environnement :** [docs/fr/database.md](docs/fr/database.md) · [EN](docs/database.md)  
- **Dés (chat + inline) :** [docs/fr/rolls-and-inline.md](docs/fr/rolls-and-inline.md) · [EN](docs/rolls-and-inline.md)  
- **Expressions d’emplacements d’équipement :** [docs/fr/equipment-slots.md](docs/fr/equipment-slots.md) · [EN](docs/equipment-slots.md)

## Index de la documentation

| Doc | Description | EN |
|-----|-------------|-----|
| [docs/fr/CODEBASE.md](docs/fr/CODEBASE.md) | Guide dev : structure, flux de données, rétrocompat | [EN](docs/CODEBASE.md) |
| [docs/fr/tab-bio.md](docs/fr/tab-bio.md) | Onglet Bio — identité et niveau | [EN](docs/tab-bio.md) |
| [docs/fr/tab-stats.md](docs/fr/tab-stats.md) | Onglet Stats — PV/PM/faveur, actions, défenses, radar, talents | [EN](docs/tab-stats.md) |
| [docs/fr/tab-spells.md](docs/fr/tab-spells.md) | Onglet Sorts — liste, coûts, USE, ordre | [EN](docs/tab-spells.md) |
| [docs/fr/tab-inventory.md](docs/fr/tab-inventory.md) | Onglet Inventaire — équipement, emplacements, monnaie, talents d’objet | [EN](docs/tab-inventory.md) |
| [docs/fr/tab-chat.md](docs/fr/tab-chat.md) | Onglet Chat — journal, jets, règles de suppression | [EN](docs/tab-chat.md) |
| [docs/fr/tab-notes.md](docs/fr/tab-notes.md) | Onglet Notes — notes riches et jets inline | [EN](docs/tab-notes.md) |
| [docs/fr/tab-settings.md](docs/fr/tab-settings.md) | Onglet Réglages — thème, options, droits, import/export | [EN](docs/tab-settings.md) |
| [docs/fr/equipment-slots.md](docs/fr/equipment-slots.md) | Langage des emplacements d’équipement | [EN](docs/equipment-slots.md) |
| [docs/fr/rolls-and-inline.md](docs/fr/rolls-and-inline.md) | Commandes de jet, boutons inline, variables, comparateurs de réussite, suffixes `!<` / `!>` | [EN](docs/rolls-and-inline.md) |
| [docs/fr/database.md](docs/fr/database.md) | Schéma Supabase, Realtime, variables, fork | [EN](docs/database.md) |
| [docs/DB_SCHEMA.sql](docs/DB_SCHEMA.sql) | DDL de référence (pas un script de migration exécutable) | — |

## Installation dans Owlbear Rodeo

### Build hébergé (ex. GitHub Pages)

1. Construire et déployer le dossier `dist/` pour que **`manifest.json`** et **`index.html`** soient servis sous une URL HTTPS stable.  
   Ce dépôt utilise le chemin de base `/Foxyverse-Owlbear-Implementation/` (voir [`vite.config.js`](vite.config.js)) ; un fork doit adapter `base` à son URL d’hébergement.
2. Dans Owlbear Rodeo, ouvrez votre salle → **Extensions** (ou le panneau extensions selon la version).
3. **Ajouter une extension** et collez l’**URL complète vers `manifest.json`**, par exemple :  
   `https://<votre-compte>.github.io/<votre-depot>/manifest.json`  
   pour cette version :  
   `https://tesachishama.github.io/Foxyverse-Owlbear-Implementation/manifest.json`  
   Si l’interface demande une URL « racine », utilisez le dossier qui contient à la fois `manifest.json` et `index.html`.

### Développement local

1. `npm install`
2. Copiez [`.env.example`](.env.example) vers `.env` et renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir [docs/fr/database.md](docs/fr/database.md)).
3. `npm run dev` et chargez l’**URL du serveur de dev Vite** dans le flux développeur d’Owlbear (même principe : Owlbear doit joindre votre machine).

## Commandes utiles

```bash
npm install
npm run dev      # serveur de dev local
npm run build    # build de production → dist/
```

Les builds de production exécutent aussi `scripts/rewrite-manifest.js` (voir `package.json`).

## Licence

MIT
