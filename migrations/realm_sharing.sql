-- ════════════════════════════════════════════════════════════════════════════
-- REALM SHARING ("Export Group")
--
-- Lets a group owner share their realm with another account. The invited
-- account is linked to one of the group's players, sees the same group and
-- game history, and can play + record games. Only the owner can delete the
-- group/games or invite others.
--
-- Also hardens the DB: enables RLS on realms/games (previously the app-side
-- .eq('user_id') filter was the only guard and games were globally readable).
--
-- Run this file in the Supabase SQL editor BEFORE deploying the client that
-- drops the app-side realm filter.
-- ════════════════════════════════════════════════════════════════════════════

-- ── PREFLIGHT ─────────────────────────────────────────────────────────────────
-- Run these SELECTs first. Any hits must be repaired (assign the right
-- user_id / realm_id, or delete the rows) — they become invisible under RLS:
--
--   select id, name from realms where user_id is null;
--   select id, date from games
--     where realm_id is null or realm_id not in (select id from realms);

-- ── 1. Membership table ───────────────────────────────────────────────────────
create table if not exists realm_members (
  id            uuid primary key default gen_random_uuid(),
  realm_id      text not null references realms(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,                      -- lowercased; display only
  player_name   text not null,                      -- which group player this account is linked to
  status        text not null default 'pending'
                  check (status in ('pending','accepted')),
  invited_by    uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (realm_id, user_id),
  unique (realm_id, player_name)                    -- one account per player (pending reserves too)
);
create index if not exists realm_members_user_idx on realm_members (user_id);

-- ── 2. Access helpers ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so realms/games policies can consult realm_members (and
-- vice versa) without RLS recursion.

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
    select 1 from realms where id = p_realm_id and user_id = auth.uid()
  ) or exists (
    select 1 from realm_members
    where realm_id = p_realm_id and user_id = auth.uid() and status = 'accepted'
  );
$$;

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
alter table realms        enable row level security;
alter table games         enable row level security;
alter table realm_members enable row level security;

-- Drop EVERY existing policy on these tables, whatever it's named. Policies
-- are OR'd together, so a single leftover dashboard-era policy like
-- "Enable read access for all users" USING (true) silently exposes every row
-- to every account regardless of the policies below.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('realms', 'games', 'realm_members')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- realms: owner full CRUD; accepted members read-only
create policy realms_select on realms for select
  using (user_id = auth.uid() or can_access_realm(id));
create policy realms_insert on realms for insert
  with check (user_id = auth.uid());
create policy realms_update on realms for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy realms_delete on realms for delete
  using (user_id = auth.uid());

-- games: owner + members can see and record; only the owner can delete.
-- No update policy — the app never updates games.
create policy games_select on games for select
  using (can_access_realm(realm_id));
create policy games_insert on games for insert
  with check (realm_id is not null and can_access_realm(realm_id));
create policy games_delete on games for delete
  using (is_realm_owner(realm_id));

-- realm_members: own rows + everyone in the realm can see the linkage list.
-- Deliberately NO insert/update/delete policies — all writes go through RPCs.
create policy realm_members_select on realm_members for select
  using (user_id = auth.uid() or can_access_realm(realm_id));

-- ── 3b. Verify ────────────────────────────────────────────────────────────────
-- After running, these should show rowsecurity = true and ONLY the policies
-- created above (realms_select/insert/update/delete, games_select/insert/
-- delete, realm_members_select). Any extra row here is a security hole:
--
--   select tablename, rowsecurity from pg_tables
--     where schemaname = 'public'
--       and tablename in ('realms', 'games', 'realm_members');
--   select tablename, policyname, cmd, qual from pg_policies
--     where schemaname = 'public'
--       and tablename in ('realms', 'games', 'realm_members');

-- ── 4. RPCs ───────────────────────────────────────────────────────────────────

-- Owner invites an account (by email) to their realm, linked to one player.
create or replace function invite_to_realm(p_realm_id text, p_email text, p_player text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(trim(p_email));
  v_target uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from realms where id = p_realm_id and user_id = v_uid) then
    raise exception 'Only the group owner can send invites.';
  end if;
  -- Backstop only: unique(realm_id, player_name) already caps memberships at
  -- the number of players (max 6, including the owner's own claimed row).
  if (select count(*) from realm_members where realm_id = p_realm_id) >= 6 then
    raise exception 'Member limit reached for this group.';
  end if;
  if not exists (
    select 1 from realms
    where id = p_realm_id and players @> array[p_player]
  ) then
    raise exception 'That player isn''t in this group.';
  end if;
  if exists (
    select 1 from realm_members
    where realm_id = p_realm_id and player_name = p_player
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
    select 1 from realm_members
    where realm_id = p_realm_id and user_id = v_target
  ) then
    raise exception 'That account is already invited to this group.';
  end if;

  insert into realm_members (realm_id, user_id, invited_email, player_name, invited_by)
  values (p_realm_id, v_target, v_email, p_player, v_uid);
end $$;

-- The group creator links themself to one of the players. Stored as an
-- 'accepted' realm_members row so the linkage list, the export modal's
-- reserved players, and the invite message ("<player> invited you") all get
-- it for free.
create or replace function claim_realm_player(p_realm_id text, p_player text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from realms where id = p_realm_id and user_id = v_uid) then
    raise exception 'Only the group owner can claim their player.';
  end if;
  if not exists (
    select 1 from realms
    where id = p_realm_id and players @> array[p_player]
  ) then
    raise exception 'That player isn''t in this group.';
  end if;
  if exists (
    select 1 from realm_members
    where realm_id = p_realm_id and player_name = p_player and user_id <> v_uid
  ) then
    raise exception 'That player is already linked to another account.';
  end if;

  select email into v_email from auth.users where id = v_uid;
  insert into realm_members (realm_id, user_id, invited_email, player_name, invited_by, status)
  values (p_realm_id, v_uid, lower(v_email), p_player, v_uid, 'accepted')
  on conflict (realm_id, user_id)
  do update set player_name = excluded.player_name;
end $$;

-- Pending invites for the signed-in user, with everything the confirm UI
-- shows. inviter_player is the inviter's own claimed player in that group
-- (null for groups created before self-linking existed).
-- Return type changed: must drop before recreate.
drop function if exists list_my_pending_invites();
create function list_my_pending_invites()
returns table (
  invite_id      uuid,
  realm_id       text,
  realm_name     text,
  players        jsonb,
  player_name    text,
  inviter_email  text,
  inviter_player text,
  created_at     timestamptz
) language sql security definer stable
set search_path = public as $$
  select m.id, r.id, r.name, to_jsonb(r.players), m.player_name, u.email,
         (select om.player_name from realm_members om
            where om.realm_id = m.realm_id and om.user_id = m.invited_by
            limit 1),
         m.created_at
  from realm_members m
  join realms r on r.id = m.realm_id
  left join auth.users u on u.id = m.invited_by
  where m.user_id = auth.uid() and m.status = 'pending'
  order by m.created_at;
$$;

-- Recipient accepts (status → accepted) or declines (row deleted, freeing the
-- player link for a future invite).
create or replace function respond_to_realm_invite(p_invite_id uuid, p_accept boolean)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_accept then
    update realm_members set status = 'accepted'
    where id = p_invite_id and user_id = auth.uid() and status = 'pending';
  else
    delete from realm_members
    where id = p_invite_id and user_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- Member removes themself from a shared realm.
create or replace function leave_realm(p_realm_id text)
returns void language sql security definer
set search_path = public as $$
  delete from realm_members
  where realm_id = p_realm_id and user_id = auth.uid();
$$;

revoke execute on function
  invite_to_realm(text, text, text),
  claim_realm_player(text, text),
  list_my_pending_invites(),
  respond_to_realm_invite(uuid, boolean),
  leave_realm(text)
from anon, public;
grant execute on function
  invite_to_realm(text, text, text),
  claim_realm_player(text, text),
  list_my_pending_invites(),
  respond_to_realm_invite(uuid, boolean),
  leave_realm(text)
to authenticated;
