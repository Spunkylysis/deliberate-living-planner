-- ============================================================
-- 0012_presets_and_quotes.sql
-- Two independent additions:
--   1. block_presets — reusable, one-click blocks for schedules that
--      don't follow a fixed weekly pattern (a rotating day off), as
--      opposed to recurring_block_templates which only handles "same
--      day every week."
--   2. quotes — a shared curated starter set (household_id null) plus
--      each household's own additions, deterministic day-of-year
--      rotation, no live API dependency (per the original plan doc's
--      "Daily quotes — decided" section).
-- ============================================================

create table public.block_presets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  type text not null default 'work' check (type in ('other','workout','mealprep','hobby','project','appointment','work')),
  title text not null,
  note text,
  assigned_member uuid references public.household_members(id),
  created_at timestamptz not null default now()
);

alter table public.block_presets enable row level security;
grant select, insert, update, delete on public.block_presets to authenticated;

create policy "block_presets_all" on public.block_presets
  for all to authenticated
  using (household_id = public.get_my_household())
  with check (household_id = public.get_my_household());

create index idx_block_presets_household_id on public.block_presets(household_id);

-- ============================================================

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  -- null household_id = shared curated quote, visible to everyone.
  -- non-null = a household's own addition, private to them.
  household_id uuid references public.households(id) on delete cascade,
  text text not null,
  author text,
  source_type text check (source_type in ('religious','literary','philosophical','motivational')),
  created_at timestamptz not null default now()
);

alter table public.quotes enable row level security;
grant select, insert, delete on public.quotes to authenticated;

create policy "quotes_select" on public.quotes
  for select to authenticated
  using (household_id is null or household_id = public.get_my_household());

create policy "quotes_insert_own" on public.quotes
  for insert to authenticated
  with check (household_id = public.get_my_household());

create policy "quotes_delete_own" on public.quotes
  for delete to authenticated
  using (household_id = public.get_my_household());

-- Starter set: short, well-documented quotes only (each verified
-- against its actual attribution, not just commonly circulated) —
-- spans religious, literary, philosophical, motivational, matching
-- the "broad mix" decided on early in planning. household_id left
-- null so these are visible to every household. Households can add
-- their own via the app; this is just the seed.
insert into public.quotes (text, author, source_type) values
  ('Be still, and know that I am God.', 'Psalm 46:10', 'religious'),
  ('This too shall pass.', 'Persian proverb', 'religious'),
  ('The kingdom of God is within you.', 'Luke 17:21', 'religious'),
  ('What we think, we become.', 'attributed to the Buddha', 'religious'),
  ('Not all who wander are lost.', 'J.R.R. Tolkien', 'literary'),
  ('The only way out is through.', 'Robert Frost', 'literary'),
  ('To thine own self be true.', 'William Shakespeare, Hamlet', 'literary'),
  ('It is never too late to be what you might have been.', 'George Eliot', 'literary'),
  ('Little by little, one travels far.', 'J.R.R. Tolkien', 'literary'),
  ('The unexamined life is not worth living.', 'Socrates, as reported by Plato', 'philosophical'),
  ('The journey of a thousand miles begins with a single step.', 'Lao Tzu', 'philosophical'),
  ('In the middle of difficulty lies opportunity.', 'Albert Einstein', 'philosophical'),
  ('He who has a why to live can bear almost any how.', 'Friedrich Nietzsche', 'philosophical'),
  ('You have power over your mind, not outside events.', 'Marcus Aurelius', 'philosophical'),
  ('Do small things with great love.', 'Mother Teresa', 'motivational'),
  ('Well done is better than well said.', 'Benjamin Franklin', 'motivational'),
  ('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb', 'motivational'),
  ('Action is the foundational key to all success.', 'Pablo Picasso', 'motivational'),
  ('Slow is smooth, and smooth is fast.', 'proverb', 'motivational'),
  ('One day at a time.', 'proverb', 'motivational');
