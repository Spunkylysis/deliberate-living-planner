-- ============================================================
-- 0004_pantry_recipes_extras.sql
-- Schema pieces designed during planning/grill-me but not yet
-- migrated: dietary restrictions, recipe ratings/calories,
-- ingredient substitutions, and the monetization placeholder.
-- ============================================================

-- Per-member dietary restrictions. severity distinguishes a hard
-- exclude (allergy/intolerance) from a soft preference (dislike).
-- e.g. [{"item":"gluten","severity":"avoid_always"},
--       {"item":"onions","severity":"prefer_not"}]
alter table public.profiles
  add column dietary_restrictions jsonb not null default '[]'::jsonb;

-- Recipe metadata authored during the one-time AI batch pass:
-- healthiness stars, spice level, approximate calories, and
-- serving-size scaling by group (adult male / adult female / child).
alter table public.recipes
  add column stars int check (stars between 1 and 5),
  add column chili_level int check (chili_level between 1 and 3),
  add column calories_per_serving int,
  add column base_servings int not null default 4,
  add column serving_multipliers jsonb not null default
    '{"adult_male":1.25,"adult_female":1.0,"child":0.6}'::jsonb;

-- Known ingredient substitutions for a given restriction, e.g.
-- ("all-purpose flour", "gluten", "1:1 gluten-free flour blend").
-- Shared across all households — this is reference data, not
-- household-specific, so it intentionally has no household_id / RLS.
create table public.ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  original_ingredient text not null,
  restriction text not null,
  substitute text not null,
  notes text
);

-- Shared reference data, deliberately no RLS (not household-specific) —
-- but still needs an explicit read grant, same lesson learned the first
-- time around with this exact mistake on the original schema.
grant select on public.ingredient_substitutions to authenticated;

-- Monetization placeholder (see NEXTJS_PLAN.md "Monetization horizon") --
-- adding the column now is free; no gating logic exists yet, and none
-- should until there's a real reason to build it.
alter table public.households
  add column plan text not null default 'free' check (plan in ('free','paid'));
