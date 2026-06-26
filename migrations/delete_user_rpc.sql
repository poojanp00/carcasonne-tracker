-- Run this in the Supabase SQL editor.
-- Creates a secure RPC that lets an authenticated user delete their own auth account.
-- SECURITY DEFINER allows the function to delete from the protected auth.users table.
create or replace function delete_user()
returns void
language sql
security definer
as $$
  delete from auth.users where id = auth.uid();
$$;
