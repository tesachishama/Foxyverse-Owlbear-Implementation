# Onglet Chat

[English (EN)](../tab-chat.md)

**Journal de salle** partagé par les utilisateurs de l’extension dans la même room Owlbear, plus la **zone de saisie** pour envoyer du texte et des **commandes de jet**.

## Messages

Chaque ligne indique la **feuille** associée au message et le **joueur** émetteur. Les résultats de jets et les lignes « système » utilisent des charges utiles structurées pour rester **neutres sur la langue** en base tout en s’affichant dans la langue du lecteur.

## Envoi

- Saisie en bas de l’écran ; **Envoyer** enregistre la ligne dans Supabase (`chat`) pour ce `room_id`.
- Si la ligne est une **commande de jet** (commence par `/`), l’extension exécute le jet et enregistre la **ligne de résultat** (pas la commande brute). Voir [Jets et boutons inline](rolls-and-inline.md).

## Suppression

Si une ligne affiche une icône **supprimer**, vous pouvez retirer le message :

- **MJ** — tout message.
- **Non-MJ** — uniquement vos propres messages (`player_id` = vous).

Les suppressions se synchronisent via Realtime et des broadcasts pour mettre à jour tous les clients.

## Défilement

Barre latérale avec flèches et curseur pour parcourir un historique long.

## Langue (en-tête de l’extension)

Les drapeaux **English / Français** dans le chrome de l’extension changent les libellés UI et le rendu de certaines lignes de chat. La préférence est en `localStorage` et peut hériter des données de room.

## Voir aussi

- [Base de données](database.md) — table `chat` et variables `VITE_CHAT_*`.
