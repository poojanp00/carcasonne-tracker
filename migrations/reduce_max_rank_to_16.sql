-- ════════════════════════════════════════════════════════════════════════════
-- RANK LADDER: 20 ranks -> 16
--
-- src/utils/metaRank.js's RANK_TITLES was cut from 20 entries down to 16
-- (new title set) — that edit alone has no effect on the deployed app:
-- App.jsx's applyMaxRank overwrites the client's RANK_TITLES.length fallback
-- with whatever app_config.max_rank actually holds (see data/storage.js
-- getMaxRankConfig), same reasoning as every other rank/milestone config
-- value in this project. Without this migration every real session keeps
-- computing against max_rank = 20 regardless of the new 16-title array.
--
-- Everything downstream of max_rank — tiersRequiredForRank's
-- ceil((rank/maxRank)^1.5 * totalTiers) formula, both client-side
-- (utils/metaRank.js) and server-side (compute_account_progress) — reads
-- getMaxRank()/app_config.max_rank dynamically, so it re-derives itself
-- against the new ceiling with no separate formula change needed. What DOES
-- need a manual step is recomputing every existing account: the same
-- tierCount now maps to a different rank under the new formula (fewer total
-- ranks means each rank number represents a larger share of the ladder, so
-- it takes more tiers to hold the same rank NUMBER — but the ceiling itself
-- is also lower, so no one can end up above rank 16 either way), and ranks
-- 17-20 no longer exist at all, so anyone previously sitting there needs to
-- be pulled down to wherever their real tierCount now lands.
-- ════════════════════════════════════════════════════════════════════════════

begin;

update app_config set value = '16'::jsonb where key = 'max_rank';

-- Retroactively recompute every account with a progress row — same pattern
-- as migrations/reorder_wins_milestone.sql. Cheap: compute_account_progress
-- is STABLE and scoped to one account's own games/realms.
do $$
declare v_uid uuid;
begin
  for v_uid in select user_id from user_progress loop
    perform sync_user_progress_row(v_uid);
  end loop;
end $$;

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select * from app_config where key = 'max_rank';  -- 16
--   select user_id, rank, tier_count, updated_at from user_progress order by updated_at desc limit 10;
--   -- No row's rank should exceed 16.
