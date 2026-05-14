-- Foxyverse database schema (REFERENCE ONLY)
-- Source: provided by project owner (2026-04-25).
--
-- WARNING:
-- - This file is for context only and is NOT meant to be run.
-- - Table order and constraints may not be valid for execution.
-- - When changing any persistence logic in `src/data/storage.js`, verify
--   column names/types here first to avoid schema-cache mismatches.


CREATE TABLE public.bio (
  sheet_id uuid NOT NULL,
  name text,
  surname text,
  element text,
  class text,
  level integer NOT NULL DEFAULT 1,
  CONSTRAINT bio_pkey PRIMARY KEY (sheet_id),
  CONSTRAINT bio_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.chat (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  sheet_id uuid NOT NULL,
  player_id text NOT NULL,
  content text NOT NULL,
  time_sent timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_pkey PRIMARY KEY (id),
  CONSTRAINT chat_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.room(id),
  CONSTRAINT chat_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.currency (
  sheet_id uuid NOT NULL,
  gold integer NOT NULL DEFAULT 0,
  silver integer NOT NULL DEFAULT 0,
  copper integer NOT NULL DEFAULT 0,
  CONSTRAINT currency_pkey PRIMARY KEY (sheet_id),
  CONSTRAINT currency_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL,
  type text NOT NULL,
  position integer NOT NULL,
  name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  physical_defense integer NOT NULL DEFAULT 0,
  magical_defense integer NOT NULL DEFAULT 0,
  constitution integer NOT NULL DEFAULT 0,
  strength integer NOT NULL DEFAULT 0,
  intelligence integer NOT NULL DEFAULT 0,
  perception integer NOT NULL DEFAULT 0,
  social integer NOT NULL DEFAULT 0,
  agility integer NOT NULL DEFAULT 0,
  focus integer NOT NULL DEFAULT 0,
  usable_slots jsonb,
  used_slots jsonb,
  CONSTRAINT item_pkey PRIMARY KEY (id),
  CONSTRAINT item_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.room (
  id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT room_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sheet (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  is_elemental boolean NOT NULL DEFAULT false,
  current_health integer NOT NULL DEFAULT 0,
  temporary_health integer NOT NULL DEFAULT 0,
  current_mana integer NOT NULL DEFAULT 0,
  current_favor integer NOT NULL DEFAULT 0,
  bonus_action integer NOT NULL DEFAULT 0,
  bonus_speed integer NOT NULL DEFAULT 0,
  notes text,
  color_bg text NOT NULL CHECK (color_bg ~ '^#[0-9A-Fa-f]{6}$'::text),
  color_ui text NOT NULL CHECK (color_ui ~ '^#[0-9A-Fa-f]{6}$'::text),
  color_text text NOT NULL CHECK (color_text ~ '^#[0-9A-Fa-f]{6}$'::text),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sheet_pkey PRIMARY KEY (id),
  CONSTRAINT sheet_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.room(id)
);
CREATE TABLE public.sheet_permissions (
  sheet_id uuid NOT NULL,
  player_id text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  CONSTRAINT sheet_permissions_pkey PRIMARY KEY (sheet_id, player_id),
  CONSTRAINT sheet_permissions_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.spell (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL,
  position integer NOT NULL,
  name text NOT NULL,
  description text,
  cost integer NOT NULL DEFAULT 0,
  is_hp boolean NOT NULL DEFAULT false,
  is_continuous boolean NOT NULL DEFAULT false,
  is_armed boolean NOT NULL DEFAULT false,
  use_counter integer NOT NULL DEFAULT 0,
  CONSTRAINT spell_pkey PRIMARY KEY (id),
  CONSTRAINT spell_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
CREATE TABLE public.stat (
  sheet_id uuid NOT NULL,
  stat_id text NOT NULL CHECK (stat_id = ANY (ARRAY['constitution'::text, 'strength'::text, 'intelligence'::text, 'perception'::text, 'social'::text, 'agility'::text, 'focus'::text])),
  base integer NOT NULL DEFAULT 5,
  passive integer NOT NULL DEFAULT 0,
  CONSTRAINT stat_pkey PRIMARY KEY (sheet_id, stat_id),
  CONSTRAINT stat_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id)
);
-- Talent ownership: a row belongs to EITHER a sheet (sheet-wide talent) OR an item
-- (weapon/armor-bound talent that only appears when equipped). Enforced by
-- talent_owner_xor. Deleting an item cascades to its talents.
CREATE TABLE public.talent (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid,
  item_id uuid,
  position integer NOT NULL,
  name text NOT NULL,
  description text,
  tier integer NOT NULL DEFAULT 1,
  bonus_override text,
  is_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT talent_pkey PRIMARY KEY (id),
  CONSTRAINT talent_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheet(id),
  CONSTRAINT talent_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE,
  CONSTRAINT talent_owner_xor CHECK (
    (sheet_id IS NOT NULL AND item_id IS NULL)
    OR (sheet_id IS NULL AND item_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS talent_item_id_idx ON public.talent(item_id);