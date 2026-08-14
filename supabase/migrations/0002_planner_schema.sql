-- ============================================================
-- 0002_planner_schema.sql
-- Domain tables for the Deliberate Living planner.
-- Mirrors the current HTML prototype's data model 1:1 so a
-- future frontend can migrate from window.storage to Supabase
-- with minimal remapping.
-- ============================================================

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text,
  unit text,
  qty_on_hand numeric not null default 0,
  par_level numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  source text not null default 'saved' check (source in ('saved', 'ai')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  qty numeric not null default 1,
  unit text
);

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  slot int not null check (slot between 1 and 3),
  recipe_id uuid references public.recipes(id) on delete set null,
  unique (household_id, week_start, slot)
);

create table public.weekly_blocks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  day_of_week text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  time_block text not null check (time_block in ('Early AM','Morning','Midday','Evening')),
  type text not null default 'other' check (type in ('other','workout','mealprep','hobby','project','appointment')),
  title text not null,
  note text,
  assigned_member uuid references public.profiles(id),
  done boolean not null default false,
  unique (household_id, week_start, day_of_week, time_block)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  appt_date date not null,
  time_block text not null default 'Midday' check (time_block in ('Early AM','Morning','Midday','Evening')),
  assigned_member uuid references public.profiles(id),
  placed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.hobbies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_per_month int not null default 4
);

create table public.hobby_log (
  id uuid primary key default gen_random_uuid(),
  hobby_id uuid not null references public.hobbies(id) on delete cascade,
  completed_at date not null default current_date,
  logged_by uuid references public.profiles(id)
);

create table public.house_projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  due_date date,
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Done')),
  notes text
);

create table public.chore_library (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  assigned_member uuid references public.profiles(id),
  frequency text not null default 'Weekly' check (frequency in ('Daily','Weekly','Monthly','One-time')),
  auto_recur boolean not null default true,
  recur_weekday int check (recur_weekday between 0 and 6),
  recur_month_day int check (recur_month_day between 1 and 31),
  due_date date,
  steps jsonb not null default '[]'::jsonb,
  rec_link text,
  created_at timestamptz not null default now()
);

create table public.chore_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chore_library(id) on delete cascade,
  week_start date not null,
  day_of_week text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  done boolean not null default false,
  auto_generated boolean not null default true
);

create table public.sunday_reset_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  item_key text not null,
  checked boolean not null default false,
  unique (household_id, week_start, item_key)
);

create table public.month_theme (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null,
  theme text,
  unique (household_id, month)
);
