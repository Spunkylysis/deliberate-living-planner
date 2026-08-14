-- ============================================================
-- 0007_performance_indexes.sql
-- Addresses Supabase's performance advisor findings after 0001-0006:
--   - Unindexed foreign keys, most importantly household_id on every
--     table — RLS filters by this on every single query, so this
--     isn't a cosmetic lint fix, it's the difference between an
--     index lookup and a sequential scan as data grows.
--   - RLS policies calling auth.uid() directly instead of
--     (select auth.uid()), which Postgres re-evaluates per row
--     instead of once per query.
-- ============================================================

create index if not exists idx_appointments_household_id on public.appointments(household_id);
create index if not exists idx_appointments_assigned_member on public.appointments(assigned_member);
create index if not exists idx_chore_instances_household_id on public.chore_instances(household_id);
create index if not exists idx_chore_instances_chore_id on public.chore_instances(chore_id);
create index if not exists idx_chore_library_household_id on public.chore_library(household_id);
create index if not exists idx_chore_library_assigned_member on public.chore_library(assigned_member);
create index if not exists idx_hobbies_household_id on public.hobbies(household_id);
create index if not exists idx_hobby_log_hobby_id on public.hobby_log(hobby_id);
create index if not exists idx_hobby_log_logged_by on public.hobby_log(logged_by);
create index if not exists idx_house_projects_household_id on public.house_projects(household_id);
create index if not exists idx_households_created_by on public.households(created_by);
create index if not exists idx_meal_plan_recipe_id on public.meal_plan(recipe_id);
create index if not exists idx_pantry_items_household_id on public.pantry_items(household_id);
create index if not exists idx_pantry_items_updated_by on public.pantry_items(updated_by);
create index if not exists idx_profiles_household_id on public.profiles(household_id);
create index if not exists idx_recipe_ingredients_recipe_id on public.recipe_ingredients(recipe_id);
create index if not exists idx_recipes_household_id on public.recipes(household_id);
create index if not exists idx_recipes_created_by on public.recipes(created_by);
create index if not exists idx_weekly_blocks_assigned_member on public.weekly_blocks(assigned_member);
-- meal_plan.household_id, weekly_blocks.household_id, chore_instances.week_start
-- etc. are already covered by the composite UNIQUE constraints defined
-- in 0002, which create their own supporting indexes automatically.

-- RLS performance fix: wrap auth.uid() in (select ...) so Postgres
-- evaluates it once per query instead of once per row.
drop policy "households_select" on public.households;
create policy "households_select" on public.households
  for select to authenticated
  using (id = public.get_my_household() or created_by = (select auth.uid()));

drop policy "households_update" on public.households;
create policy "households_update" on public.households
  for update to authenticated
  using (id = public.get_my_household() or created_by = (select auth.uid()));

drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (household_id = public.get_my_household() or id = (select auth.uid()));

drop policy "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()));
