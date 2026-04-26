-- Allow talent bonus_override to store formulas (roll syntax).
-- Existing integer overrides are preserved as text.
ALTER TABLE public.talent
  ALTER COLUMN bonus_override TYPE text
  USING (bonus_override::text);

-- Migrate legacy formula storage from description marker into bonus_override (best-effort).
-- Format was:
--   <description>\n[[override]]<formula>
UPDATE public.talent
SET
  bonus_override = NULLIF(TRIM(SUBSTRING(description FROM '\\[\\[override\\]\\](.*)$')), ''),
  description = REGEXP_REPLACE(description, '\\s*\\n\\[\\[override\\]\\].*$', '', 'g')
WHERE description ~ '\\[\\[override\\]\\]';

