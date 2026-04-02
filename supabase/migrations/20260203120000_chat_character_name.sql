-- Display name of the character sheet at send time (Name Surname snapshot)
ALTER TABLE public.chat ADD COLUMN IF NOT EXISTS character_name text NOT NULL DEFAULT '';
