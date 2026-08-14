-- ============================================================
-- 0006_fix_function_privileges.sql
-- 0005 revoked EXECUTE "FROM PUBLIC" only, which worked in local
-- testing but NOT on the live project — Supabase's platform grants
-- anon/authenticated EXECUTE on new public-schema functions directly
-- at creation time, separate from (and in addition to) the implicit
-- PUBLIC grant. Revoking from PUBLIC alone leaves that separate grant
-- untouched. Confirmed via has_function_privilege() against the live
-- database after 0005 — anon could still call get_my_household(),
-- contradicting what local testing showed and what the advisor
-- re-scan (misleadingly) suggested was still a problem either way.
-- This revokes explicitly by role name instead.
-- ============================================================

revoke execute on function public.get_my_household() from public, anon, authenticated;
grant execute on function public.get_my_household() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
