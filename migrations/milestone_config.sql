-- ════════════════════════════════════════════════════════════════════════════
-- MILESTONE/RANK CONFIG — single source of truth for the NUMBERS
--
-- Part 1 of the server-side rank/milestone computation project (see plan:
-- "Server-Side Rank/Milestone Computation"). The rank/milestone rules
-- (category thresholds, tier count, which expansions count as "full", the
-- rank formula's MAX_RANK) currently live only in JS (data/accountMilestones.js,
-- utils/metaRank.js, data/expansions.js). A later migration adds a SQL
-- function that computes an account's true cross-realm rank/milestone state
-- server-side (needed so realm co-members' progress updates correctly no
-- matter who records a shared game) — reimplementing those rules in SQL
-- would mean two hand-maintained copies of the same numbers that can
-- silently disagree. So the NUMBERS (thresholds, full-expansion names,
-- max rank) move here, into tables both SQL and the JS client read from.
--
-- Cosmetic-only fields — tier names/images, category labels, rank titles,
-- the expansion picker's display ordering/icons/completeness flags — stay
-- static JS. They never participate in any threshold comparison, so there's
-- no drift risk to eliminate for them; only the pure numbers move here.
--
-- Run this file BEFORE the next migration in this project (the aggregation
-- function reads from these tables) and before deploying any client build
-- that expects data/accountMilestones.js / data/expansions.js to fetch from
-- here (see that follow-up client-side migration note for exact ordering).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Tables ─────────────────────────────────────────────────────────────────
create table if not exists milestone_categories (
  id         text primary key,
  metric     text,        -- 'games' | 'wins' | 'expansions', or null when types-based
  types      text[],      -- score-breakdown keys to sum (e.g. {wine,grain,cloth}), null when metric-based
  sort_order int  not null
);

create table if not exists milestone_tiers (
  category_id text    not null references milestone_categories(id) on delete cascade,
  tier_number int     not null,
  threshold   numeric not null,
  primary key (category_id, tier_number)
);

create table if not exists full_expansions (
  name text primary key
);

-- Single-purpose key/value config table — today only holds max_rank, but
-- shaped to hold future account-wide numeric constants without a new table.
create table if not exists app_config (
  key   text primary key,
  value jsonb not null
);

-- ── 2. Seed data (mirrors data/accountMilestones.js / data/expansions.js
--      exactly as of this migration — this IS the authoritative copy going
--      forward; update these tables, not a JS literal, when rules change) ──

insert into milestone_categories (id, metric, types, sort_order) values
  ('games',       'games',       null,                    1),
  ('city',        null,          array['city'],            2),
  ('road',        null,          array['road'],             3),
  ('monastery',   null,          array['monastery'],        4),
  ('field',       null,          array['field'],            5),
  ('abbot',       null,          array['abbot'],            6),
  ('cathedral',   null,          array['cathedral'],        7),
  ('inn',         null,          array['inn'],               8),
  ('pig',         null,          array['pig'],               9),
  ('barn',        null,          array['barn'],             10),
  ('goods',       null,          array['wine','grain','cloth'], 11),
  ('wins',        'wins',        null,                    12),
  ('expansions',  'expansions',  null,                    13)
on conflict (id) do nothing;

insert into milestone_tiers (category_id, tier_number, threshold) values
  ('games',      1, 10),   ('games',      2, 100),  ('games',      3, 500),   ('games',      4, 1000),
  ('city',       1, 100),  ('city',       2, 1000), ('city',       3, 5000),  ('city',       4, 10000),
  ('road',       1, 50),   ('road',       2, 500),  ('road',       3, 2500),  ('road',       4, 5000),
  ('monastery',  1, 100),  ('monastery',  2, 1000), ('monastery',  3, 5000),  ('monastery',  4, 10000),
  ('field',      1, 100),  ('field',      2, 1000), ('field',      3, 5000),  ('field',      4, 10000),
  ('abbot',      1, 50),   ('abbot',      2, 500),  ('abbot',      3, 2500),  ('abbot',      4, 5000),
  ('cathedral',  1, 50),   ('cathedral',  2, 500),  ('cathedral',  3, 2500),  ('cathedral',  4, 5000),
  ('inn',        1, 50),   ('inn',        2, 500),  ('inn',        3, 2500),  ('inn',        4, 5000),
  ('pig',        1, 50),   ('pig',        2, 500),  ('pig',        3, 2500),  ('pig',        4, 5000),
  ('barn',       1, 50),   ('barn',       2, 500),  ('barn',       3, 2500),  ('barn',       4, 5000),
  ('goods',      1, 50),   ('goods',      2, 500),  ('goods',      3, 2500),  ('goods',      4, 5000),
  ('wins',       1, 5),    ('wins',       2, 50),   ('wins',       3, 250),   ('wins',       4, 500),
  ('expansions', 1, 1),    ('expansions', 2, 4),    ('expansions', 3, 7),     ('expansions', 4, 11)
on conflict (category_id, tier_number) do nothing;

-- Every data/expansions.js DEFAULT_EXPANSIONS entry with type: 'full'.
insert into full_expansions (name) values
  ('Inns & Cathedrals'),
  ('Traders & Builders'),
  ('The Princess & the Dragon'),
  ('The Tower'),
  ('Abbey & Mayor'),
  ('Count, King & Robber'),
  ('The Catapult'),
  ('Bridges, Castles & Bazaars'),
  ('Hills & Sheep'),
  ('Under the Big Top'),
  ('Ghosts, Castles & Cemeteries')
on conflict (name) do nothing;

insert into app_config (key, value) values
  ('max_rank', '20'::jsonb)
on conflict (key) do nothing;

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
-- Config, not user data — no per-row ownership. Readable by any signed-in
-- client (data/accountMilestones.js / data/expansions.js fetch this at load);
-- no insert/update/delete policy for any role — these only change via a
-- future migration, never at runtime.
alter table milestone_categories enable row level security;
alter table milestone_tiers      enable row level security;
alter table full_expansions      enable row level security;
alter table app_config           enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('milestone_categories', 'milestone_tiers', 'full_expansions', 'app_config')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

create policy milestone_categories_select on milestone_categories for select using (true);
create policy milestone_tiers_select      on milestone_tiers      for select using (true);
create policy full_expansions_select     on full_expansions     for select using (true);
create policy app_config_select          on app_config           for select using (true);

revoke insert, update, delete on milestone_categories, milestone_tiers, full_expansions, app_config
  from anon, authenticated;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select count(*) from milestone_categories;  -- 13
--   select count(*) from milestone_tiers;       -- 52
--   select count(*) from full_expansions;       -- 11
--   select * from app_config;                   -- max_rank = 20
--   select tablename, policyname, cmd from pg_policies
--     where tablename in ('milestone_categories','milestone_tiers','full_expansions','app_config');
