-- ============================================================
-- 0011_work_blocks_and_recurrence.sql
-- Two additions, both from real usage feedback:
--   1. "work" as a valid weekly_blocks type
--   2. recurring_block_templates — brings the same auto-recurring
--      pattern already proven on chores to the Weekly Grid, so a
--      fixed work schedule (or any repeating commitment) only needs
--      to be entered once.
-- ============================================================

alter table public.weekly_blocks drop constraint weekly_blocks_type_check;
alter table public.weekly_blocks
  add constraint weekly_blocks_type_check
  check (type in ('other','workout','mealprep','hobby','project','appointment','work'));

create table public.recurring_block_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  time_block text not null check (time_block in ('Early AM','Morning','Midday','Evening')),
  type text not null default 'other' check (type in ('other','workout','mealprep','hobby','project','appointment','work')),
  title text not null,
  note text,
  assigned_member uuid references public.household_members(id),
  created_at timestamptz not null default now(),
  -- A template is inherently tied to one specific cell (day + time
  -- block) per household — creating a second template for the same
  -- cell should replace it, not create a competing duplicate.
  unique (household_id, day_of_week, time_block)
);

alter table public.recurring_block_templates enable row level security;
grant select, insert, update, delete on public.recurring_block_templates to authenticated;

create policy "recurring_block_templates_all" on public.recurring_block_templates
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create index idx_recurring_block_templates_household_id on public.recurring_block_templates(household_id);
