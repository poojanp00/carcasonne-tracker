-- ════════════════════════════════════════════════════════════════════════════
-- REALM MEMBER PROGRESS: full milestone detail, not just rank
--
-- Follow-up to add_user_progress.sql. get_realm_member_progress originally
-- returned rank only (a deliberate scope decision — see project history).
-- Now widened to also return tier_count and category_progress, so a realm
-- co-member's CURRENT milestone standing can be shown on demand (e.g. a
-- "view milestones" popup from PlayerCard) — current state only, not a
-- history of past rank-up/milestone events (no new table for that; this
-- still just reads the same user_progress row add_user_progress.sql added).
--
-- Return type changed, so the function must be dropped and recreated (CREATE
-- OR REPLACE can't alter a function's return columns) — re-grants at the end
-- restore the same authenticated-only access as before.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists get_realm_member_progress(text);

create function get_realm_member_progress(p_realm_id text)
returns table (user_id text, rank int, tier_count int, category_progress jsonb)
language sql security definer stable
set search_path = public as $$
  select e->>'user_id', up.rank, up.tier_count, up.category_progress
  from realms r
  cross join lateral jsonb_array_elements(r.players) e
  join user_progress up on up.user_id = (e->>'user_id')::uuid
  where r.id = p_realm_id
    and can_access_realm(p_realm_id)
    and e->>'user_id' is not null;
$$;

revoke execute on function get_realm_member_progress(text) from anon, public;
grant execute on function get_realm_member_progress(text) to authenticated;
