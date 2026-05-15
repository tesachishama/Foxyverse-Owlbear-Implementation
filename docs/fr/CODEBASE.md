# Extension Foxyverse pour Owlbear — guide du code

[English (EN)](../CODEBASE.md)

Ce document est la **carte d’accueil** pour les développeurs. Il explique **le rôle de chaque grande partie du code**, **comment les données circulent**, et **où regarder** pour modifier un comportement. Le fichier [`src/app.js`](../../src/app.js) contient des **bandeaux de section** qui pointent vers les ancres ci-dessous (`Voir docs/CODEBASE.md#…` ou l’équivalent en parcourant ce fichier).

**Documentation orientée joueur / MJ :** [database.md](database.md), [rolls-and-inline.md](rolls-and-inline.md), [equipment-slots.md](equipment-slots.md), fichiers d’onglets dans [docs/fr/](.).

---

## Table des matières

Les ancres détaillées (pour lier depuis le code) sont en anglais dans [CODEBASE.md (EN)](../CODEBASE.md) ; ce fichier reprend les mêmes sujets en français.

1. Organisation du dépôt  
2. Démarrage et point d’entrée  
3. État global  
4. Droits et visibilité des feuilles  
5. Chargement salle et feuille  
6. Sauvegarde et mutations  
7. Dés et jets  
8. Texte riche, notes et boutons de jet inline  
9. Rendu : coque, onglets et thème  
10. Interface par onglet  
11. Modales et préparation de jet  
12. Liaison des événements (`bindEvents`)  
13. Chat persistant et temps réel  
14. Métadonnées de salle, groupe et verrous de champs  
15. Modules support  
16. Build et manifeste  
17. Ancien format et rétrocompatibilité

---

## Organisation du dépôt

**Ancre (EN) :** [../CODEBASE.md#repository-layout](../CODEBASE.md#repository-layout)

| Chemin | Rôle |
|--------|------|
| [`src/main.js`](../../src/main.js) | `OBR.onReady` Owlbear → appelle `initApp()`. |
| [`src/app.js`](../../src/app.js) | **Toute l’UI** : `state`, rendu, événements DOM, abonnements. |
| [`src/style.css`](../../src/style.css) | Styles globaux (fichier volumineux). |
| [`src/dice/parser.js`](../../src/dice/parser.js) | Analyse et évaluation des formules de jet. |
| [`src/dice/roller.js`](../../src/dice/roller.js) | Types de jets, parsing `/` et `[inline]`, application des dégâts/soins sur la feuille. |
| [`src/data/schema.js`](../../src/data/schema.js) | **Forme en mémoire** de la feuille : défauts, stats, emplacements, utilitaires. |
| [`src/data/storage.js`](../../src/data/storage.js) | **Supabase** : chargement/assemblage, persistance, chat, abonnements Realtime. |
| [`src/data/supabase.js`](../../src/data/supabase.js) | Un seul `createClient` à partir des variables `VITE_*`. |
| [`src/data/equipSlots.js`](../../src/data/equipSlots.js) | Langage des **expressions d’emplacements** (distinct des formules de dés). |
| [`src/utils/textNormalize.js`](../../src/utils/textNormalize.js) | Normalisation de chaînes partagée (diacritiques, clés). |
| [`src/i18n/translations.js`](../../src/i18n/translations.js) | Chaînes i18n et `t()`. |
| [`scripts/rewrite-manifest.js`](../../scripts/rewrite-manifest.js) | Post-build : URL absolues dans le manifeste pour l’hébergement. |

---

## Démarrage et point d’entrée

**Ancre (EN, liens depuis le code) :** [../CODEBASE.md#bootstrap-and-entry](../CODEBASE.md#bootstrap-and-entry)

Owlbear charge l’iframe de l’extension ; [`src/main.js`](../../src/main.js) attend `OBR.onReady`, importe le CSS, puis `initApp()` depuis [`src/app.js`](../../src/app.js). En cas d’erreur d’initialisation, elle est journalisée et l’UI peut afficher `state.startupError`.

`initApp` (vers la **fin** de `app.js`) **câble tout** : chargement salle / feuilles, hydratation du chat, abonnements **Realtime Supabase**, abonnements **chat**, écouteurs Owlbear sur les métadonnées de salle et le groupe.

---

## État global

**Ancre (EN) :** [../CODEBASE.md#global-state](../CODEBASE.md#global-state)

L’objet `state` (déclaré au début de [`src/app.js`](../../src/app.js)) est la **source de vérité unique** pour l’UI. Pas de framework externe : après la plupart des actions, le code met à jour `state` et appelle `render()`, qui remplace le DOM sous `#app` puis raccroche les événements via `bindEvents()`.

Champs importants (liste non exhaustive) :

- **`roomId`, `sheetIds`, `sheetNames`, `permissions`, `tokenToSheet`** — données de salle (métadonnées Owlbear + stockage).
- **`activeSheetId`, `sheet`** — feuille ouverte et objet complet en mémoire.
- **`activeTab`** — `bio` \| `stats` \| `spells` \| `inventory` \| `chat` \| `notes` \| `settings`.
- **`chatMessages`** — lignes de chat mappées pour l’affichage.
- **Drapeaux modales / brouillons** — ex. `rollModalOpen`, `rollPrepOpen`, `confirmModal`, édition sorts/objets, monnaie.
- **`isEditingField`, `_realtimePendingAfterEdit`** — éviter d’écraser la saisie ou d’appliquer le temps réel au mauvais moment.

---

## Droits et visibilité des feuilles

**Ancre (EN) :** [../CODEBASE.md#permissions-and-sheet-visibility](../CODEBASE.md#permissions-and-sheet-visibility)

- **`canView(sheetId)`** — le MJ voit tout ; les joueurs ont besoin que `permissions[playerId].view` contienne l’id de feuille.
- **`canEdit(sheetId)`** — même logique avec `.edit`.
- **`getVisibleSheets()`** — filtre `state.sheetIds` avec `canView`.

L’onglet réglages permet au MJ de configurer les listes lecture/écriture ; les valeurs sont persistées via [`src/data/storage.js`](../../src/data/storage.js) et les métadonnées Owlbear le cas échéant.

---

## Chargement salle et feuille

**Ancre (EN) :** [../CODEBASE.md#room-and-sheet-loading](../CODEBASE.md#room-and-sheet-loading)

- **`loadRoomData()`** — lit `roomId`, métadonnées (liste des feuilles, noms, droits, annuaire joueurs, verrous, langue).
- **`loadSheet(sheetId, options)`** — charge la feuille depuis Supabase (`storage.getSheet`), remplit `state.sheet`, fusionne thème/couleurs, peut réinitialiser des brouillons.

Si la feuille active est supprimée ou n’est plus visible, les loaders basculent vers une autre feuille visible ou vide l’état.

---

## Sauvegarde et mutations

**Ancre (EN) :** [../CODEBASE.md#saving-and-mutations](../CODEBASE.md#saving-and-mutations)

- **`applySheetMutation(mutator)`** — chemin async : clone, persistance via storage, puis mise à jour de `state.sheet`.
- **`applyLocalMutation(mutator)`** — chemin sync : mutation **in place** de `state.sheet` (souvent suivi d’un `storage.update*` ciblé).
- **`saveSheet()` / debounce** — regroupe les écritures pour ne pas saturer le réseau.

Les mises à jour par ligne passent par `storage.updateBio`, `storage.updateStat`, `storage.upsertItem`, etc. Le module storage projette l’objet `sheet` vers des **tables SQL normalisées** (voir [database.md](database.md)).

**Champ item `used_slots` :** utiliser **`storage.serializeUsedSlots(sheet, item)`** pour persister les emplacements équipés — même logique qu’à la lecture depuis la base (priorité à `item.usedSlots` si présent, sinon dérivation depuis `sheet.equipped`).

---

## Dés et jets

**Ancre (EN) :** [../CODEBASE.md#dice-and-rolls](../CODEBASE.md#dice-and-rolls)

- **Analyse :** [`src/dice/roller.js`](../../src/dice/roller.js) — `parseChatCommand`, `getInlineButtons`, `executeRoll`, helpers d’application (`applyPhysicalDamage`, …).
- **Math :** [`src/dice/parser.js`](../../src/dice/parser.js) — `evaluateFormula`, contexte de variables construit depuis la feuille active.

Les lignes de chat commençant par `/` sont détectées dans les gestionnaires ; le message **stocké** est la **ligne de résultat**, pas la commande brute. Les boutons `[jet …]` sont parsés dans le HTML riche du chat et des notes.

---

## Texte riche, notes et boutons de jet inline

**Ancre (EN) :** [../CODEBASE.md#rich-text-notes-and-inline-roll-buttons](../CODEBASE.md#rich-text-notes-and-inline-roll-buttons)

Des fonctions comme `renderNotesBody`, `renderChatBody` et des helpers « markdown léger » transforment le texte en HTML avec **boutons de jet cliquables**. Les infobulles (`installFvPluginTooltipDelegationOnce`, etc.) affichent du texte étendu sans casser l’accessibilité.

---

## Rendu : coque, onglets et thème

**Ancre (EN) :** [../CODEBASE.md#rendering-shell-tabs-and-theme](../CODEBASE.md#rendering-shell-tabs-and-theme)

- **`render()`** — peinture principale : conserve le défilement, remplit `innerHTML` avec `renderHeader`, `renderTabs`, `renderTabContent`, modales, puis `applyColors()`, `bindEvents()`.
- **`applyColors()`** — copie le thème de la feuille active (ou défauts) vers les variables CSS sur `:root`.
- **`renderHeader` / `renderTabs`** — sélecteur de feuille, drapeaux de langue, contexte MJ/joueur.

---

## Interface par onglet

**Ancre (EN) :** [../CODEBASE.md#per-tab-ui](../CODEBASE.md#per-tab-ui)

Chaque onglet a une fonction `render*Tab()` qui renvoie une chaîne HTML :

| Fonction | Rôle |
|----------|------|
| `renderBioTab` | Identité, classe, niveau, élément, etc. |
| `renderStatsTab` | PV/PM/faveur, stats, talents, défenses, radar, raccourcis de jet. |
| `renderSpellsTab` | Liste des sorts, coûts, glisser-déposer, USE. |
| `renderInventoryTab` | Objets par section, emplacements, monnaie, talents d’objet. |
| `renderChatTab` | Fil des messages, saisie, intégration des jets. |
| `renderNotesTab` | Édition vs aperçu des notes riches. |
| `renderSettingsTab` | Thème, import/export, droits, liaison jeton. |

`renderTabContent()` fait un `switch` sur `state.activeTab`.

---

## Modales et préparation de jet

**Ancre (EN) :** [../CODEBASE.md#modals-and-roll-prep](../CODEBASE.md#modals-and-roll-prep)

- **Modale de résultat de jet** — détail des dés, relance faveur, boutons Appliquer.
- **Modale de préparation de jet** — étape optionnelle (talents, formule additionnelle).
- **Modale de confirmation** — motif générique async (`openConfirmModal` / `closeConfirmModal`).
- **Modales suppression / transfert** — sorts, objets, consommables, monnaie.

Ces flux lisent/écrivent des champs dédiés sur `state` et appellent `render()` à l’ouverture/fermeture.

---

## Liaison des événements (`bindEvents`)

**Ancre (EN) :** [../CODEBASE.md#event-binding-bindevents](../CODEBASE.md#event-binding-bindevents)

`bindEvents()` s’exécute **après chaque rendu complet**. Elle attache les écouteurs sur les nœuds dans `#app` (délégation d’événements à quelques endroits ; beaucoup de `data-*` ciblés). Cela évite les closures sur un DOM obsolète au prix d’un re-branchement à chaque paint.

Les grandes zones correspondent à : en-tête / sélecteur de feuille, steppers stats, inventaire (glisser-déposer), envoi chat, bascule notes, formulaires réglages, etc.

---

## Chat persistant et temps réel

**Ancre (EN) :** [../CODEBASE.md#chat-persistence-and-realtime](../CODEBASE.md#chat-persistence-and-realtime)

- **Insert / update / delete** — `storage.insertChatMessage`, `storage.updateChatMessageBody`, `storage.deleteChatMessage`, et helpers de diffusion pour plusieurs clients.
- **`subscribeToChat`** — canal Realtime pour nouveaux messages, suppressions et mises à jour de corps (ex. remplacer une ligne de jet lors d’une relance faveur).

`mapChatRow` / `appendChatMessageIfNew` normalisent les lignes dans `state.chatMessages`.

---

## Métadonnées de salle, groupe et verrous de champs

**Ancre (EN) :** [../CODEBASE.md#room-metadata-party-and-field-locks](../CODEBASE.md#room-metadata-party-and-field-locks)

- **`OBR.room.onMetadataChange`** — réapplique `tokenToSheet`, `playerDirectory`, `fieldLocks`, langue depuis `metadata.foxyverse`.
- **`OBR.party.onChange`** — rafraîchit les joueurs connectés et persiste l’annuaire.
- **Verrous de champs** — garde-fou d’édition collaborative : acquisition / libération d’ids de verrou dans les métadonnées de salle.

---

## Modules support

**Ancre (EN) :** [../CODEBASE.md#supporting-modules](../CODEBASE.md#supporting-modules)

### `schema.js`

**Valeurs par défaut** d’une nouvelle feuille (`createEmptySheet`), structure des stats, listes d’emplacements, `evalModifier`, plafonds PV/PM, défenses, formatage des paliers de connaissance. Données + maths — pas de réseau.

### `equipSlots.js`

Évalue les **expressions d’équipement** sur les objets (grammaire distincte des dés). Utilisé pour l’affichage inventaire et la validation d’équipement.

### `storage.js`

Tout l’accès **Supabase** : `getSheet` / `persistSheet`, mises à jour par table, `assembleSheet`, Realtime `subscribeToRoom` / `subscribeToChat`, cache **sessionStorage** pour réouverture rapide.

### `supabase.js`

Lève une erreur à l’import si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` manque — échec rapide en dev.

### `translations.js`

`setLocale`, `t("clé")`, et `enterField` pour les libellés de formulaires.

---

## Build et manifeste

**Ancre (EN) :** [../CODEBASE.md#build-and-manifest](../CODEBASE.md#build-and-manifest)

- **`vite build`** produit `dist/` avec des noms de fichiers hachés.
- **`scripts/rewrite-manifest.js`** — réécrit `dist/manifest.json` pour que `action.icon` et `action.popover` utilisent des **URL HTTPS absolues** (nécessaire sur GitHub Pages). Ajoute un suffixe de version (SHA git ou horodatage) pour le cache busting.

---

## Ancien format et rétrocompatibilité

**Ancre (EN) :** [../CODEBASE.md#legacy-and-backward-compatibility](../CODEBASE.md#legacy-and-backward-compatibility)

Ne **pas** retirer sans **plan de migration** des données :

- Champs feuille **`actionModifier` / `speedModifier`** dans [`schema.js`](../../src/data/schema.js) — anciennes feuilles peuvent encore les avoir ; l’UI privilégie les champs bonus récents.
- Les **objets** peuvent encore avoir un seul objet **`talent`** ; l’app normalise vers **`talents[]`**.
- **Clés d’équipement** — anciens identifiants PascalCase ou emplacements obsolètes sont mappés via `SLOT_LEGACY_TO_CANON` / `canonizeSlotToken` à la lecture de `sheet.equipped` ou de formes cachées.
- Le **CSS** peut référencer un id legacy du textarea des notes — conservé pour ne pas casser d’anciennes captures HTML.

Pour les nouvelles fonctionnalités, **préférer les formes récentes** dans `createEmptySheet` et les chemins de persistance, tout en gardant des **lecteurs tolérants** aux anciennes données.
