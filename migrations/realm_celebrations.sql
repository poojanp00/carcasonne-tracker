-- ════════════════════════════════════════════════════════════════════════════
-- SHOW EVERY LINKED PLAYER'S CELEBRATION ON THE CONTROLLER'S SCREEN
--
-- Follow-up to rank_up_acknowledgement.sql / fix_last_celebrated_drop.sql.
-- This app is used around one shared device at the table — whoever is
-- "controlling" (recording scores) isn't necessarily the only one who should
-- see a rank-up/milestone celebration; everyone playing is right there. So
-- instead of deferring another linked player's celebration to whenever THEY
-- personally next open the app, the controller's own post-game screen shows
-- every linked player's pending celebration, one at a time, right after the
-- game is recorded.
--
-- This needs two new RPCs: reading another linked account's full progress
-- (not just rank — get_realm_member_progress deliberately stays rank-only,
-- a separate narrower feature for the Fellowship badge) is normally blocked
-- by user_progress's self-only RLS; and acknowledging "seen" on behalf of a
-- DIFFERENT account (only the account itself could call acknowledge_rank_up
-- before) needs its own permission check.
-- ════════════════════════════════════════════════════════════════════════════

-- Every linked (owner/member) account's full progress snapshot for one
-- realm — gated by can_access_realm, same security shape as
-- get_realm_member_progress/get_realm_member_emails, just a wider payload
-- (this app's whole premise is one shared screen for the group actually
-- playing together, so exposing more than a rank number to a co-member here
-- is the intended trade-off, unlike the Fellowship badge's narrower scope).
create or replace function get_realm_celebrations(p_realm_id text)
returns table (
  user_id text,
  name text,
  rank int,
  tier_count int,
  category_progress jsonb,
  games_count int,
  last_celebrated_rank int,
  last_celebrated_tier_count int,
  last_celebrated_category_progress jsonb
)
language sql security definer stable
set search_path = public as $$
  select
    e->>'user_id', e->>'name',
    up.rank, up.tier_count, up.category_progress, up.games_count,
    up.last_celebrated_rank, up.last_celebrated_tier_count, up.last_celebrated_category_progress
  from realms r
  cross join lateral jsonb_array_elements(r.players) e
  join user_progress up on up.user_id = (e->>'user_id')::uuid
  where r.id = p_realm_id
    and can_access_realm(p_realm_id)
    and e->>'user_id' is not null;
$$;

revoke execute on function get_realm_celebrations(text) from anon, public;
grant execute on function get_realm_celebrations(text) to authenticated;

-- Acknowledge "seen" on behalf of ANOTHER linked account in a shared realm
-- (e.g. the controller dismissing a co-member's celebration on the shared
-- screen) — same ratchet/clamp semantics as acknowledge_rank_up, just
-- gated by realm co-membership instead of requiring auth.uid() = the
-- account being acknowledged.
create or replace function acknowledge_rank_up_for(
  p_realm_id text, p_user_id uuid, p_rank int, p_tier_count int, p_category_progress jsonb
)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_existing        jsonb;
  v_live_rank       int;
  v_live_tier_count int;
  v_merged          jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not can_access_realm(p_realm_id) then
    raise exception 'Cannot access this realm.';
  end if;
  if not exists (
    select 1 from realms r
    cross join lateral jsonb_array_elements(r.players) e
    where r.id = p_realm_id and e->>'user_id' = p_user_id::text
  ) then
    raise exception 'That account is not linked to this realm.';
  end if;

  select last_celebrated_category_progress, rank, tier_count
  into v_existing, v_live_rank, v_live_tier_count
  from user_progress where user_id = p_user_id
  for update;

  if not found then
    raise exception 'No progress row for that account yet.';
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
  where user_id = p_user_id;
end $$;

revoke execute on function acknowledge_rank_up_for(text, uuid, int, int, jsonb) from anon, public;
grant execute on function acknowledge_rank_up_for(text, uuid, int, int, jsonb) to authenticated;
