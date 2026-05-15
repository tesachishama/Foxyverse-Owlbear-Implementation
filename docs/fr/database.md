# Base de données et auto-hébergement (Supabase)

[English (EN)](../database.md)

L’extension est une **application Vite statique** qui dialogue avec **Supabase** (PostgreSQL + Realtime) via la **clé anon** dans le navigateur. Il n’y a pas d’autre backend dédié dans ce dépôt.

Vue d’ensemble opérateur : [DB_SCHEMA.sql](../DB_SCHEMA.sql) (DDL de référence). Pour préparer un fork, lisez ce fichier et [`.env.example`](../../.env.example).

## Variables d’environnement

Définies au **build** (`import.meta.env`). À renseigner dans `.env` en local et dans les secrets CI pour la production (voir [.github/workflows/main.yml](../../.github/workflows/main.yml)).

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `VITE_SUPABASE_URL` | Oui | URL du projet Supabase (`https://xxx.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Oui | Clé publique **anon** Supabase (côté client). |
| `VITE_CHAT_MESSAGE_COLUMN` | Non | Colonne du corps du message dans `chat`. Défaut : `content`. |
| `VITE_CHAT_TIME_COLUMN` | Non | Colonne horodatage. Défaut : `time_sent`. |

La sanitisation des noms de colonnes optionnels est faite dans [`src/data/storage.js`](../../src/data/storage.js) ; un identifiant invalide revient aux valeurs par défaut.

Si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` manque, le client lève une erreur au démarrage ([`src/data/supabase.js`](../../src/data/supabase.js)).

## Forme de la table `chat`

Chaque ligne `chat` doit au minimum exposer :

- `id`, `room_id`, `sheet_id`, `player_id`
- Une colonne texte pour le corps (défaut **`content`**, surchargée par `VITE_CHAT_MESSAGE_COLUMN`)
- Une colonne horodatage (défaut **`time_sent`**, surchargée par `VITE_CHAT_TIME_COLUMN`)

Activez **Supabase Realtime** sur `chat` (INSERT, et UPDATE/DELETE si vous utilisez édition/suppression). Le client utilise aussi des **broadcasts** sur le même canal pour propager suppressions/mises à jour.

## Realtime : abonnements côté client

### Canal « room » (`subscribeToRoom`)

Événements Postgres sur ces tables (filtrés pour n’appartenir qu’à la **room** Owlbear courante) :

- `sheet`
- `sheet_permissions`
- `bio`
- `stat`
- `talent` (lignes liées à la feuille ou à un objet ; les événements objet sont rattachés à la feuille propriétaire)
- `spell`
- `currency`
- `item`

### Canal « chat » (`subscribeToChat`)

- `chat` : INSERT, DELETE, UPDATE (selon les handlers)
- Broadcast : `chat_deleted`, `chat_updated`

## Tables (vue logique)

Alignez les colonnes sur [DB_SCHEMA.sql](../DB_SCHEMA.sql). Schéma typique :

| Table | Rôle |
|-------|------|
| `room` | Une ligne par id de salle Owlbear utilisant l’extension. |
| `sheet` | Feuille : PV/PM/faveur, couleurs, notes, drapeaux (`is_elemental`, `auto_quick_roll`), horodatages. |
| `bio` | Nom, prénom, élément, classe, niveau (1:1 avec `sheet`). |
| `stat` | Une ligne par caractéristique (`base`, `passive`). |
| `talent` | Talents de **feuille** (`sheet_id` renseigné, `item_id` nul) ou d’**objet** (`item_id` renseigné, `sheet_id` nul) ; contrainte XOR. |
| `spell` | Liste des sorts ; colonne optionnelle `element` (voir migrations). |
| `item` | Armes, armures, consommables, sacs, divers ; JSONB `usable_slots` / `used_slots` ; bonus. |
| `currency` | Or / argent / cuivre par feuille. |
| `sheet_permissions` | Droits voir / éditer par joueur et par feuille. |
| `chat` | Journal de salle (résultats de jets, lignes système, etc.). |

## Migrations

Les scripts SQL d’évolution sont sous [`supabase/migrations/`](../../supabase/migrations/). Exemple : colonne texte optionnelle `spell.element`.

Si vous importez un ancien dump, comparez-le à [DB_SCHEMA.sql](../DB_SCHEMA.sql) et appliquez les colonnes ou contraintes manquantes avant de lancer un build contre ce projet.

## Row Level Security (RLS)

Ce dépôt ne fournit **pas** un jeu complet de politiques RLS. Les forks doivent configurer **RLS** (et la **publication Realtime**) pour que :

- les joueurs ne lisent/écrivent que les données prévues (souvent politiques anon permissives en playtest ; plus strictes en production).

Voir la [documentation RLS Supabase](https://supabase.com/docs/guides/auth/row-level-security). Testez avec la clé anon comme le feront les clients.

## Héberger l’extension (fork)

1. Projet Supabase, schéma + migrations, RLS et Realtime.
2. Secrets GitHub `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir le workflow).
3. Ajuster le **`base`** dans [`vite.config.js`](../../vite.config.js) pour correspondre à l’URL où est servi `dist/` (ex. GitHub Pages `/<dépôt>/`). `index.html` et `manifest.json` doivent se résoudre sous ce préfixe.
4. `npm run build` produit les artefacts ; Owlbear charge l’URL d’extension (voir [README.md](../../README.md) à la racine).

## Exports de référence

Un export SQL externe (tableau de bord Supabase) peut différer par l’ordre des tables ou de petites colonnes. Référence de vérité pour le code actuel : **`docs/DB_SCHEMA.sql`** + **`supabase/migrations/`** + [`src/data/storage.js`](../../src/data/storage.js).
