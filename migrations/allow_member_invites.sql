-- ════════════════════════════════════════════════════════════════════════════
-- ALLOW MEMBERS TO INVITE
--
-- Follow-up to realm_members_to_players.sql (run that first). Any linked
-- account (owner or accepted member) can now send invites, not just the
-- owner. To keep the invite prompt truthful, the inviter's user id is stamped
-- on the pending element as 'invited_by' and shown by
-- list_my_pending_invites(); it is stripped again on accept/decline.
--
-- CREATE OR REPLACE preserves the existing grants (authenticated-only).
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Any owner/member invites an account (by email) to one uninvited player slot.
create or replace function invite_to_realm(p_realm_id text, p_email text, p_player text)
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
  from realms where id = p_realm_id
  for update;
  if v_players is null then
    raise exception 'Group not found.';
  end if;
  if not (
    exists (select 1 from realms where id = p_realm_id and user_id = v_uid)
    or exists (
      select 1 from jsonb_array_elements(v_players) e
      where e->>'user_id' = v_uid::text and e->>'status' in ('owner', 'member')
    )
  ) then
    raise exception 'Only group members can send invites.';
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
        then e.elem || jsonb_build_object(
               'user_id',    v_target::text,
               'status',     'pending',
               'invited_by', v_uid::text)
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;
end $$;

-- Pending invites for the signed-in user. Inviter = whoever sent it
-- ('invited_by' on the pending element), falling back to the realm owner for
-- invites created before attribution existed.
create or replace function list_my_pending_invites()
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
         pe.player_name,
         coalesce(
           nullif(iu.raw_user_meta_data->>'display_name', ''),
           nullif(ou.raw_user_meta_data->>'display_name', ''),
           (select e->>'name' from jsonb_array_elements(r.players) e
             where e->>'status' = 'owner' limit 1)),
         coalesce(iu.email, ou.email),
         r.created_at
  from realms r
  cross join lateral (
    select e->>'name' as player_name, (e->>'invited_by')::uuid as invited_by
    from jsonb_array_elements(r.players) e
    where e->>'user_id' = auth.uid()::text and e->>'status' = 'pending'
    limit 1
  ) pe
  left join auth.users ou on ou.id = r.user_id
  left join auth.users iu on iu.id = pe.invited_by
  where r.players @> jsonb_build_array(
          jsonb_build_object('user_id', auth.uid()::text, 'status', 'pending'))
  order by r.created_at;
$$;

-- Accept/decline: elements are rebuilt with only the canonical keys, so the
-- transient 'invited_by' stamp is dropped either way.
create or replace function respond_to_realm_invite(p_realm_id text, p_accept boolean)
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
          then jsonb_build_object('name', e.elem->>'name', 'user_id', v_uid::text, 'status', 'member')
          else jsonb_build_object('name', e.elem->>'name', 'user_id', null, 'status', 'uninvited')
        end
        else e.elem
      end order by e.ord)
    from jsonb_array_elements(players) with ordinality e(elem, ord)
  ) where id = p_realm_id;
end $$;

-- Emails of the accounts linked to a realm's players (any status), for the
-- status-label hover tooltips. Caller must be able to access the realm.
-- Emails stay out of the players jsonb — this is a read-time lookup only.
create or replace function get_realm_member_emails(p_realm_id text)
returns table (user_id text, email text)
language sql security definer stable
set search_path = public as $$
  select e->>'user_id', u.email
  from realms r
  cross join lateral jsonb_array_elements(r.players) e
  join auth.users u on u.id = (e->>'user_id')::uuid
  where r.id = p_realm_id
    and can_access_realm(p_realm_id)
    and e->>'user_id' is not null;
$$;

revoke execute on function get_realm_member_emails(text) from anon, public;
grant execute on function get_realm_member_emails(text) to authenticated;

commit;
