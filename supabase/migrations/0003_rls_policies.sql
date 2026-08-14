-- ============================================================
-- 0003_rls_policies.sql
-- Every table is scoped to the caller's household via
-- get_my_household(). Only the `authenticated` role gets
-- access — no anon reads, unlike the open-anon pattern used
-- in the fantasy baseball project (fine for a 28-person league,
-- not fine for household data with real people's schedules).
-- ============================================================

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plan enable row level security;
alter table public.weekly_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.hobbies enable row level security;
alter table public.hobby_log enable row level security;
alter table public.house_projects enable row level security;
alter table public.chore_library enable row level security;
alter table public.chore_instances enable row level security;
alter table public.sunday_reset_checks enable row level security;
alter table public.month_theme enable row level security;

-- RLS policies only filter ROWS. Postgres still requires base table
-- privileges before a role can touch a table at all — Supabase's
-- dashboard grants these implicitly for its built-in roles, but a
-- portable migration has to do it explicitly.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.households,
  public.profiles,
  public.pantry_items,
  public.recipes,
  public.recipe_ingredients,
  public.meal_plan,
  public.weekly_blocks,
  public.appointments,
  public.hobbies,
  public.hobby_log,
  public.house_projects,
  public.chore_library,
  public.chore_instances,
  public.sunday_reset_checks,
  public.month_theme
to authenticated;

-- households: any authenticated user may create one (onboarding);
-- the creator can see/update it immediately via created_by, even
-- before their own profile.household_id is linked to it (otherwise
-- INSERT ... RETURNING fails, since Postgres checks the SELECT
-- policy on RETURNING and get_my_household() would still be null
-- at that point). Once household_id is set, get_my_household() also
-- grants access — so other joined members can see it too.
create policy "households_insert" on public.households
  for insert to authenticated with check (true);
create policy "households_select" on public.households
  for select to authenticated using (id = public.get_my_household() or created_by = auth.uid());
create policy "households_update" on public.households
  for update to authenticated using (id = public.get_my_household() or created_by = auth.uid());

-- profiles: visible to anyone in the same household, and always
-- visible to yourself even before you've joined a household
-- (household_id = get_my_household() is NULL = NULL, which SQL
-- never treats as true, so self-visibility needs an explicit OR).
create policy "profiles_select" on public.profiles
  for select to authenticated using (household_id = public.get_my_household() or id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Generic household-scoped pattern, repeated per table.
create policy "pantry_items_all" on public.pantry_items
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "recipes_all" on public.recipes
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

-- Child tables without their own household_id: scope via parent.
create policy "recipe_ingredients_all" on public.recipe_ingredients
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.household_id = public.get_my_household()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.household_id = public.get_my_household()));

create policy "meal_plan_all" on public.meal_plan
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "weekly_blocks_all" on public.weekly_blocks
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "appointments_all" on public.appointments
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "hobbies_all" on public.hobbies
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "hobby_log_all" on public.hobby_log
  for all to authenticated
  using (exists (select 1 from public.hobbies h where h.id = hobby_id and h.household_id = public.get_my_household()))
  with check (exists (select 1 from public.hobbies h where h.id = hobby_id and h.household_id = public.get_my_household()));

create policy "house_projects_all" on public.house_projects
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "chore_library_all" on public.chore_library
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "chore_instances_all" on public.chore_instances
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "sunday_reset_checks_all" on public.sunday_reset_checks
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create policy "month_theme_all" on public.month_theme
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());
