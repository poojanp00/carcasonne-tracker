-- ════════════════════════════════════════════════════════════════════════════
-- REORDER: 'wins' milestone category moves to 2nd place
--
-- src/data/accountMilestones.js's hardcoded ACCOUNT_MILESTONES array was
-- edited directly (Furniture -> Games label, wins moved to slot 2) but that
-- edit alone has no effect on the deployed app — App.jsx's applyMilestoneConfig
-- (data/storage.js getMilestoneConfig) REPLACES that array's contents at load
-- time with whatever milestone_categories/milestone_tiers actually contain,
-- sorted by sort_order (see migrations/milestone_config.sql's comment:
-- cosmetic fields like label/name never come from the DB, but ordering does).
-- Without this migration, 'wins' stays at its old sort_order (12, near the
-- end) in every real session regardless of the JS array's new order.
--
-- Only sort_order changes here — ids/metric/types/thresholds are untouched.
-- ════════════════════════════════════════════════════════════════════════════

begin;

update milestone_categories set sort_order = 2  where id = 'wins';
update milestone_categories set sort_order = 3  where id = 'city';
update milestone_categories set sort_order = 4  where id = 'road';
update milestone_categories set sort_order = 5  where id = 'monastery';
update milestone_categories set sort_order = 6  where id = 'field';
update milestone_categories set sort_order = 7  where id = 'abbot';
update milestone_categories set sort_order = 8  where id = 'cathedral';
update milestone_categories set sort_order = 9  where id = 'inn';
update milestone_categories set sort_order = 10 where id = 'pig';
update milestone_categories set sort_order = 11 where id = 'barn';
update milestone_categories set sort_order = 12 where id = 'goods';
-- 'games' stays at sort_order 1 — unchanged.

commit;

-- ── VERIFY ─────────────────────────────────────────────────────────────────────
--   select id, sort_order from milestone_categories order by sort_order;
--   -- Expect: games(1), wins(2), city(3), road(4), monastery(5), field(6),
--   --         abbot(7), cathedral(8), inn(9), pig(10), barn(11), goods(12)
