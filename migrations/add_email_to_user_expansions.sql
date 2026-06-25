-- Add a denormalized email column to user_expansions so the table is readable
-- in the Supabase editor (user_id UUIDs alone are hard to identify).
-- The app populates it on save; this also backfills existing rows.

alter table user_expansions add column if not exists email text;

update user_expansions ue
set email = u.email
from auth.users u
where u.id = ue.user_id;
