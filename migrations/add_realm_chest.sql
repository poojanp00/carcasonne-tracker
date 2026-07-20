-- Persist each realm's treasure chest art, chosen once at creation (mirrors
-- the spine/logbook column in add_realm_spine.sql). The picker is new, so
-- existing realms get a one-time random chest assignment here; their logbook
-- spine is untouched.
--
-- Run BEFORE deploying the client that writes/reads this column.

alter table public.realms
  add column if not exists chest integer;

-- 6 = current count of images/chests/basic/*.png at the time this migration
-- was written. If chests are added/removed before running this, update the
-- number to match so the backfill picks uniformly among the real options.
update public.realms
  set chest = floor(random() * 6)::int
  where chest is null;
