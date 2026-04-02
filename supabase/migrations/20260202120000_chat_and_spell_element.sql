-- Room chat log (Supabase Realtime enabled on table `chat` in dashboard)
CREATE TABLE IF NOT EXISTS public.chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.room (id) ON DELETE CASCADE,
  player_id text NOT NULL DEFAULT '',
  player_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_room_created_idx ON public.chat (room_id, created_at);

-- Spell optional element tag (e.g. Fire, Water)
ALTER TABLE public.spell ADD COLUMN IF NOT EXISTS element text NOT NULL DEFAULT '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat TO anon, authenticated;
