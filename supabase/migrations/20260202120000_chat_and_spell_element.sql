-- Spell optional element tag (e.g. Fire, Water). Chat table is assumed to already exist in your project with:
--   id, room_id, sheet_id, player_id, message, time_sent (see README).
ALTER TABLE public.spell ADD COLUMN IF NOT EXISTS element text NOT NULL DEFAULT '';
