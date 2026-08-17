-- ============================================================
-- 0009_backfill_household_members.sql
-- The sync trigger in 0008 only fires on FUTURE household_id
-- changes. Anyone who already had household_id set before this
-- migration ran (i.e. any real user before today) never got a
-- household_members row created for them. One-time backfill,
-- safe to run more than once thanks to the ON CONFLICT clause.
-- ============================================================

insert into public.household_members
  (household_id, profile_id, display_name, color, role, phone, email, dietary_restrictions)
select
  p.household_id, p.id, p.display_name, p.color, p.role, p.phone, p.email, p.dietary_restrictions
from public.profiles p
where p.household_id is not null
on conflict (profile_id) do update set
  household_id = excluded.household_id;
