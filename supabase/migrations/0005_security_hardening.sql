-- ============================================================
-- 0005_security_hardening.sql
-- Fixes three findings from Supabase's own security advisor,
-- run after 0001-0004. All three verified against local Postgres
-- before applying here — signup trigger and RLS-internal calls
-- to get_my_household() both confirmed still working post-fix.
-- ============================================================

-- ERROR: ingredient_substitutions had no RLS. It's intentionally
-- public read-only reference data (not household-scoped), but
-- "no RLS at all" and "RLS enabled with an explicit read-only
-- policy" are different postures — the latter is safer even when
-- the practical result is similar, since it can't silently become
-- writable by a future GRANT mistake without a matching policy.
alter table public.ingredient_substitutions enable row level security;
create policy "ingredient_substitutions_select" on public.ingredient_substitutions
  for select to authenticated using (true);

-- WARN (x2): get_my_household() and handle_new_user() were both
-- callable directly via the exposed PostgREST RPC API by anyone,
-- including anon (unauthenticated). Neither is meant to be called
-- directly by API consumers — get_my_household() is a helper used
-- inside RLS policies, and handle_new_user() only runs via the
-- auth.users signup trigger.
--
-- Verified locally before applying here: revoking PUBLIC execute
-- does not break the signup trigger (trigger firing isn't gated by
-- the invoking role's own EXECUTE grant), and re-granting to
-- `authenticated` specifically preserves RLS policies that call
-- get_my_household() internally.
revoke execute on function public.get_my_household() from public;
grant execute on function public.get_my_household() to authenticated;

revoke execute on function public.handle_new_user() from public;
