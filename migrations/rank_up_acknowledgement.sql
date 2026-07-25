-- ════════════════════════════════════════════════════════════════════════════
-- RANK-UP CELEBRATION TRACKING
--
-- SUPERSEDED IN PART by migrations/fix_last_celebrated_drop.sql — run that
-- one too. As originally written, sync_user_progress_row here never touched
-- last_celebrated_* on conflict, so a drop in true rank/tier_count (a
-- deleted game) left last_celebrated_* frozen above reality — replaying back
-- up to that same old peak later silently showed nothing. Only
-- acknowledge_rank_up's ratchet-up-on-explicit-ack below is still correct
-- as-is.
--
-- Part 3 (run after migrations/milestone_config.sql and
-- migrations/server_side_progress.sql). user_progress.rank/tier_count/
-- category_progress are a LIVE mirror of current truth (see
-- migrations/user_progress_live_cache.sql) — they can now be updated by any
-- linked account's game save via the trigger in server_side_progress.sql,
-- not just the account's own client. To show the celebratory RankUpModal
-- exactly once per real increase (and not on the account's very first ever
-- check, before it has any baseline to compare against), a SEPARATE
-- "have I already shown this" marker is needed — last_celebrated_* — updated
-- only by the client's own explicit acknowledgement, never by the sync
-- trigger.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table user_progress
  add column if not exists last_celebrated_rank int not null default 1
    check (last_celebrated_rank between 1 and 20),
  add column if not exists last_celebrated_tier_count int not null default 0
    check (last_celebrated_tier_count >= 0),
  add column if not exists last_celebrated_category_progress jsonb not null default '{}'::jsonb;

-- One-time backfill for rows that already existed before this migration —
-- without this, every pre-existing account would see a false "you just
-- unlocked everything" celebration the first time a post-migration client
-- checks them.
update user_progress
set last_celebrated_rank = rank,
    last_celebrated_tier_count = tier_count,
    last_celebrated_category_progress = category_progress
where last_celebrated_rank = 1
  and last_celebrated_tier_count = 0
  and last_celebrated_category_progress = '{}'::jsonb;

-- ── 2. sync_user_progress_row — seed last_celebrated_* on first-ever row ───────
-- Replaces the version in server_side_progress.sql now that the columns
-- exist. On conflict (an existing row), last_celebrated_* stays untouched —
-- only acknowledge_rank_up (below) ever moves it after row creation.
create or replace function sync_user_progress_row(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  r record;
begin
  select * into r from compute_account_progress(p_user_id);

  insert into user_progress (
    user_id, rank, tier_count, category_progress, games_count, updated_at,
    last_celebrated_rank, last_celebrated_tier_count, last_celebrated_category_progress
  )
  values (
    p_user_id, r.rank, r.tier_count, r.category_progress, r.games_count, now(),
    r.rank, r.tier_count, r.category_progress
  )
  on conflict (user_id) do update
    set rank              = excluded.rank,
        tier_count        = excluded.tier_count,
        category_progress = excluded.category_progress,
        games_count       = excluded.games_count,
        updated_at        = now();
        -- last_celebrated_* intentionally omitted from the update clause —
        -- only acknowledge_rank_up moves it once a row already exists.
end;
$$;

revoke execute on function sync_user_progress_row(uuid) from public, anon, authenticated;

-- ── 3. acknowledge_rank_up ───────────────────────────────────────────────────
-- Self-write. Ratchet semantics deliberately, unlike the live "current
-- truth" fields: "have I already shown this celebration" should never
-- regress. Per-field greatest() for rank/tier_count, per-key max merge for
-- category_progress (same merge shape the original, now-retired
-- user_progress ratchet used). Clamped to never exceed what's genuinely
-- true in rank/tier_count right now, so a client can't acknowledge ahead of
-- reality.
create or replace function acknowledge_rank_up(
  p_rank int, p_tier_count int, p_category_progress jsonb
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid             uuid := auth.uid();
  v_existing        jsonb;
  v_live_rank       int;
  v_live_tier_count int;
  v_merged          jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select last_celebrated_category_progress, rank, tier_count
  into v_existing, v_live_rank, v_live_tier_count
  from user_progress where user_id = v_uid
  for update;

  if not found then
    raise exception 'No progress row for this account yet.';
  end if;

  select jsonb_object_agg(
    coalesce(new_e.key, old_e.key),
    jsonb_build_object(
      'progress',   greatest(coalesce((old_e.val->>'progress')::numeric, 0), coalesce((new_e.val->>'progress')::numeric, 0)),
      'tierNumber', greatest(coalesce((old_e.val->>'tierNumber')::int, 0),    coalesce((new_e.val->>'tierNumber')::int, 0))
    )
  )
  into v_merged
  from jsonb_each(coalesce(p_category_progress, '{}'::jsonb)) as new_e(key, val)
  full outer join jsonb_each(coalesce(v_existing, '{}'::jsonb)) as old_e(key, val)
    on old_e.key = new_e.key;

  update user_progress
  set last_celebrated_rank = greatest(last_celebrated_rank, least(greatest(1, least(20, p_rank)), v_live_rank)),
      last_celebrated_tier_count = greatest(last_celebrated_tier_count, least(greatest(0, p_tier_count), v_live_tier_count)),
      last_celebrated_category_progress = coalesce(v_merged, last_celebrated_category_progress)
  where user_id = v_uid;
end $$;

revoke execute on function acknowledge_rank_up(int, int, jsonb) from anon, public;
grant execute on function acknowledge_rank_up(int, int, jsonb) to authenticated;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select user_id, rank, tier_count, last_celebrated_rank, last_celebrated_tier_count
--     from user_progress limit 20; -- last_celebrated_* should equal rank/tier_count
--     -- for every pre-existing row immediately after this migration runs.
