-- Persist each realm's logbook spine art, chosen once at creation.
-- NULL on legacy realms: the client falls back to the old id-hash pick,
-- so existing shelves keep the exact books they show today.
--
-- Run BEFORE deploying the client that writes the column.

alter table public.realms
  add column if not exists spine integer;
