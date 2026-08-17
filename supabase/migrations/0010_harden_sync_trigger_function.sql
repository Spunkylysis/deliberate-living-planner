-- ============================================================
-- 0010_harden_sync_trigger_function.sql
-- sync_profile_to_household_members() (added in 0008) was missed
-- when the EXECUTE-hardening pattern was applied to the other
-- trigger/helper functions in 0005/0006. Same fix, same reasoning:
-- this function only runs via the AFTER UPDATE trigger on
-- profiles.household_id — nobody should be able to call it
-- directly via the exposed PostgREST RPC endpoint. Using explicit
-- role names, not "FROM PUBLIC" alone, per the lesson learned in
-- 0006: Supabase grants anon/authenticated execute on new functions
-- directly, separately from the implicit PUBLIC grant.
-- ============================================================

revoke execute on function public.sync_profile_to_household_members()
  from public, anon, authenticated;
