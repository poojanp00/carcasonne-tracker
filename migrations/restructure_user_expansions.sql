-- Restructure expansion ownership: one JSONB row per user.
--
-- The old `expansions` table stored one row per (user × expansion) with a
-- redundant `type` column, which caused row explosion, duplicate/legacy names,
-- and stale `type` values. The catalog (name/type/order) lives in code
-- (src/data/expansions.js); the DB only needs to record which expansions each
-- user owns.

-- 1. New table: one row per user, owned expansions as a JSONB array of names.
create table if not exists user_expansions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owned   jsonb not null default '[]'::jsonb,  -- ["Inns & Cathedrals", "The Ferries", ...]
  email   text                                 -- denormalized for readability in the DB editor
);

alter table user_expansions enable row level security;

create policy "own rows - select" on user_expansions
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on user_expansions
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on user_expansions
  for update using (auth.uid() = user_id);

-- 2. Backfill from the old table: collect owned expansion names per user.
--    Only owned rows for real users are carried over; legacy comma-less
--    duplicate names are harmless (they are ignored when the app rebuilds the
--    list from the canonical catalog).
insert into user_expansions (user_id, owned)
select user_id, jsonb_agg(distinct name)
from expansions
where owned = true and user_id is not null
group by user_id
on conflict (user_id) do update set owned = excluded.owned;

-- 3. After verifying the app works, drop the old table to remove the legacy
--    rows permanently:
-- drop table expansions;
