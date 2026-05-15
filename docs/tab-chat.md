# Chat tab

[Français (FR)](fr/tab-chat.md)

Room-wide **chat log** shared by everyone in the Owlbear room using the extension, plus the **composer** to send text and **roll commands**.

## Messages

Each line shows which **character sheet** the message is tied to (`sheet_id`) and which **player** sent it. Roll results and system apply lines use structured payloads so text can stay **locale-neutral** in the database and still render in the viewer’s language.

## Sending

- Type in the **input** at the bottom; **Send** posts the message to Supabase `chat` for this `room_id`.
- If the line parses as a **roll command** (starts with `/`), the extension runs the roll and stores the **result line** (not the raw command). See [Rolls and inline buttons](rolls-and-inline.md).

## Deleting

If a message has a **delete** (trash) control, you may remove it:

- **GM** — can delete any message.
- **Non-GM** — can delete only messages you sent (`player_id` matches you).

Deletes sync via Realtime and broadcast helpers so all clients update.

## Scrolling

Use the sidebar arrows or drag the thumb to move through long histories.

## Language (extension header)

**English / Français** flags in the extension chrome switch UI strings and how some chat payloads are rendered. Preference is stored in `localStorage` and can default from room data when present.

## Related

- [Database](database.md) — `chat` table and `VITE_CHAT_*` column overrides.
