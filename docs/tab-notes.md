# Notes tab

[Français (FR)](fr/tab-notes.md)

Per-character **free-form notes** stored on the sheet (`notes` field in Supabase).

## View vs edit

- With **edit** permission: use the **pencil** to toggle **edit mode**.
- **View mode** — notes render as rich HTML: basic formatting from the toolbar, and the same **inline roll button** syntax as chat (`[type formula]`). Buttons are clickable and post rolls to chat.
- **Edit mode** — raw **HTML/Markup** in a textarea; use the toolbar to insert tags (bold, italic, underline, horizontal rule, headings). Toggle back to view to see rendered output.

## Scrolling

Long notes use a scroll area with arrows and a draggable thumb (same pattern as Chat).

## Who can edit

Read-only users see notes in **view** mode only (no pencil).

## Related

- [Rolls and inline buttons](rolls-and-inline.md) — inline button syntax in rendered notes.
