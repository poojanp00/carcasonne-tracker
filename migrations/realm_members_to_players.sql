-- ════════════════════════════════════════════════════════════════════════════
-- FOLD realm_members INTO realms.players (jsonb)
--
-- Simplifies realm sharing to a single table: realms.players changes from
-- text[] of names to a jsonb array of objects
--
--   { "name": "Poojan", "user_id": "<uuid>" | null, "status": "owner" }
--
-- with status one of 'owner' (the creator's claimed player), 'member'
-- (accepted invite), 'pending' (invite sent), 'uninvited' (no linked
-- account). No email is stored — invite_to_realm resolves email → user id at
-- invite time. Existing realm_members rows are backfilled into the jsonb,
-- then the table is dropped.
--
-- NOTE: with the table gone, membership invariants (one account per player,
-- one player per account) are enforced only by the RPCs below plus row locks —
-- there are no DB constraints backing them anymore. All membership writes must
-- keep going through these RPCs.
--
-- DEPLOY COORDINATION: the previous client queries realm_members and renders
-- players as plain strings; the new client expects objects and the new RPC
-- signatures. Run this file in the Supabase SQL editor first, then deploy the
-- client immediately after — stale clients misbehave until they reload.
-- ════════════════════════════════════════════════════════════════════════════

-- ── PREFLIGHT ─────────────────────────────────────────────────────────────────
-- Run these SELECTs first and repair any hits before running the migration:
--
--   -- Realms with a NULL players column (backfill treats these as empty):
--   select id, name from realms where players is null;
--
--   -- Membership rows whose player_name no longer matches a realm player.
--   -- These would silently DROP during the backfill (the jsonb keys
--   -- membership by player name):
--   select m.* from realm_members m
--   join realms r on r.id = m.realm_id
--   where not (r.players @> array[m.player_name]);
--
--   -- Realms with duplicate player names. The jsonb design matches elements
--   -- by name, so duplicates must be renamed first:
--   select id, name, players from realms
--   where (select count(*) from unnest(players) p) >
--         (select count(distinct p) from unnest(players) p);

begin;

-- ── 1. Convert players text[] → jsonb, backfilling from realm_members ────────
-- ALTER ... TYPE ... USING can't run subqueries, so: add, populate, swap.
alter table realms add column players_v2 jsonb;

update realms r set players_v2 = coalesce((
  select jsonb_agg(jsonb_build_object(
    'name',    u.p,
    'user_id', m.user_id,                 -- uuid serializes as text; null stays null
    'status',  case
                 when m.user_id is null     then 'uninvited'
                 when m.status = 'pending'  then 'pending'
                 when m.user_id = r.user_id then 'owner'
                 else 'member'
               end
  ) order by u.ord)
  from unnest(r.players) with ordinality as u(p, ord)
  left join realm_members m
    on m.realm_id = r.id and m.player_name = u.p
), '[]'::jsonb);

alter table realms drop column players;
alter table realms rename column players_v2 to players;
alter table realms alter column players set default '[]'::jsonb;
alter table realms alter column players set not null;

-- Serves the @> containment checks in can_access_realm / list_my_pending_invites.
create index if not exists realms_players_gin on realms using gin (players jsonb_path_ops);

-- ── 2. Access helpers ─────────────────────────────────────────────────────────
-- Same names/signatures as before so the existing realms/games policies keep
-- working untouched. SECURITY DEFINER so the games policies can consult realms
-- (and realms_select can consult itself) without RLS recursion.
-- uuid vs jsonb: elements store user_id as a jsonb string, so every
-- comparison must cast auth.uid()::text — a missed cast silently fails.

create or replace function is_realm_owner(p_realm_id text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from realms where id = p_realm_id and user_id = auth.uid()
  );
$$;

create or replace function can_access_realm(p_realm_id text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from realms
    where id = p_realm_id and (
      user_id = auth.uid()
      or players @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text, 'status', 'member'))
      or players @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text, 'status', 'owner'))
    )
  );
$$;

-- RLS policies on realms/games are unchanged (owner CRUD + member read on
-- realms; member read/insert + owner delete on games). Pending invitees
-- deliberately get NO select access — list_my_pending_invites() feeds the
-- invite prompt. realm_members_select dies with the table in step 4.

-- ── 3. RPCs ───────────────────────────────────────────────────────────────────
-- Signatures/returns changed, so drop the old set explicitly.
drop function if exists invite_to_realm(text, text, text);
drop function if exists claim_realm_player(text, text);       -- retired: owner
                                                              -- element is written at realm creation
drop function if exists list_my_pending_invites();
drop function if exists respond_to_realm_invite(uuid, boolean);
drop function if exists leave_realm(text);

-- Owner invites an account (by email) to one uninvited player slot.
create function invite_to_realm(p_realm_id text, p_email text, p_player text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(trim(p_email));
  v_target  uuid;
  v_players jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  -- Row lock: serializes concurrent invites/responses on the same realm.
  select players into v_players
  from realms where id = p_realm_id and user_id = v_uid
  for update;
  if v_players is null then
    raise exception 'Only the group owner can send invites.';
  end if;
  -- Backstop only: players arrays are capped at 6 by the app anyway.
  if (select count(*) from jsonb_array_elements(v_players) e
      where e->>'user_id' is not null) >= 6 then
    raise exception 'Member limit reached for this group.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_players) e
    where e->>'name' = p_player
  ) then
    raise exception 'That player isn''t in this group.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_players) e
    where e->>'name' = p_player and e->>'status' = 'uninvited'
  ) then
    raise exception 'That player is already linked to an account.';
  end if;

  select id into v_target from auth.users where lower(email) = v_email limit 1;
  if v_target is null then
    raise exception 'No account found with that email.';
  end if;
  if v_target = v_uid then
    raise exception 'You can''t invite yourself.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_players) e
    where e->>'user_id' = v_target::text
  ) then
    raise exception 'That account is already invited to this group.';
  end if;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'name' = p_player
        then e.elem || jsonb_build_object('user_id', v_target::text, 'status', 'pending')
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;
end $$;

-- Pending invites for the signed-in user, with everything the confirm UI
-- shows. The inviter is by definition the realm owner: display_name from
-- their auth metadata, falling back to their owner-status player name.
create function list_my_pending_invites()
returns table (
  realm_id      text,
  realm_name    text,
  players       jsonb,
  player_name   text,
  inviter_name  text,
  inviter_email text,
  created_at    timestamptz
) language sql security definer stable
set search_path = public as $$
  select r.id, r.name, r.players,
         (select e->>'name' from jsonb_array_elements(r.players) e
           where e->>'user_id' = auth.uid()::text and e->>'status' = 'pending'
           limit 1),
         coalesce(
           nullif(u.raw_user_meta_data->>'display_name', ''),
           (select e->>'name' from jsonb_array_elements(r.players) e
             where e->>'status' = 'owner' limit 1)),
         u.email,
         r.created_at
  from realms r
  left join auth.users u on u.id = r.user_id
  where r.players @> jsonb_build_array(
          jsonb_build_object('user_id', auth.uid()::text, 'status', 'pending'))
  order by r.created_at;
$$;

-- Recipient accepts (→ member) or declines (element reset to uninvited,
-- freeing the slot for a future invite). Keyed by realm — an account has at
-- most one element per realm. No-op if there is no pending element.
create function respond_to_realm_invite(p_realm_id text, p_accept boolean)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  perform 1 from realms where id = p_realm_id for update;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'user_id' = v_uid::text and e.elem->>'status' = 'pending'
        then case when p_accept
          then e.elem || jsonb_build_object('status', 'member')
          else e.elem || jsonb_build_object('user_id', null, 'status', 'uninvited')
        end
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;
end $$;

-- Member removes themself from a shared realm (owner elements are untouched —
-- owners delete the realm instead).
create function leave_realm(p_realm_id text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  perform 1 from realms where id = p_realm_id for update;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'user_id' = v_uid::text and e.elem->>'status' = 'member'
        then e.elem || jsonb_build_object('user_id', null, 'status', 'uninvited')
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;
end $$;

-- Account deletion cleanup: reset the caller's elements in realms they don't
-- own (owned realms are deleted separately by the app). Replaces the FK
-- cascade the realm_members table used to provide.
create function unlink_me_from_shared_realms()
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update realms set players = (
    select jsonb_agg(
      case when e.elem->>'user_id' = v_uid::text
        then e.elem || jsonb_build_object('user_id', null, 'status', 'uninvited')
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  )
  where user_id <> v_uid
    and players @> jsonb_build_array(jsonb_build_object('user_id', v_uid::text));
end $$;

revoke execute on function
  invite_to_realm(text, text, text),
  list_my_pending_invites(),
  respond_to_realm_invite(text, boolean),
  leave_realm(text),
  unlink_me_from_shared_realms()
from anon, public;
grant execute on function
  invite_to_realm(text, text, text),
  list_my_pending_invites(),
  respond_to_realm_invite(text, boolean),
  leave_realm(text),
  unlink_me_from_shared_realms()
to authenticated;

-- ── 4. Drop the membership table ──────────────────────────────────────────────
-- Its realm_members_select policy and indexes go with it.
drop table realm_members;

commit;

-- ── VERIFY ────────────────────────────────────────────────────────────────────
-- After running:
--
--   -- Statuses landed correctly:
--   select id, name, jsonb_pretty(players) from realms;
--
--   -- Only the seven expected policies remain (realms_select/insert/update/
--   -- delete, games_select/insert/delete) and realm_members is gone:
--   select tablename, policyname, cmd from pg_policies
--     where schemaname = 'public' and tablename in ('realms', 'games', 'realm_members');
--   select count(*) from information_schema.tables
--     where table_schema = 'public' and table_name = 'realm_members';  -- 0

-- ── ONE-OFF: display_name backfill for pre-existing accounts ─────────────────
-- Accounts created before the signup "Your Name" field have no display_name.
-- Set one per account (used to prefill Player 1 when creating a group):
--
--   update auth.users
--   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--                            || jsonb_build_object('display_name', 'NAME_HERE')
--   where email = 'account@example.com';
