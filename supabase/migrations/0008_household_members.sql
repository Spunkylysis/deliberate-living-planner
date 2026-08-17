-- ============================================================
-- 0008_household_members.sql
-- Decouples "can be assigned/displayed" from "has a login."
-- profiles remains the auth-linked table (one row per real
-- Supabase Auth account). household_members becomes the roster
-- everything else assigns against — some rows are linked to a
-- real profile (adults who log in), others are placeholder-only
-- (kids, or anyone who shouldn't have their own account).
-- ============================================================

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  color text not null default '#c9974c',
  role text,
  phone text,
  email text,
  dietary_restrictions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  -- Multiple NULLs are allowed under a unique constraint in Postgres
  -- (NULLs are never considered equal to each other), so this only
  -- enforces "a real profile can back at most one roster row" without
  -- blocking multiple placeholder rows.
  unique (profile_id)
);

alter table public.household_members enable row level security;

grant select, insert, update, delete on public.household_members to authenticated;

-- Anyone in the household can see the full roster.
create policy "household_members_select" on public.household_members
  for select to authenticated
  using (household_id = public.get_my_household());

-- Only placeholder rows (profile_id null) can be created directly —
-- linked rows are only ever created by the trigger below, never typed
-- in by a user, so nobody can falsely attach themselves to someone
-- else's real account.
create policy "household_members_insert" on public.household_members
  for insert to authenticated
  with check (household_id = public.get_my_household() and profile_id is null);

-- Trust model, stated explicitly: a real account holder can only edit
-- their OWN linked row (self-sovereignty for people who can log in and
-- speak for themselves) — but ANY household member can edit a
-- placeholder row, since a kid has no account to manage their own entry
-- with. This means one adult could edit a placeholder representing a
-- different adult's kid, which is an intentional trust decision for a
-- household of people who already trust each other, not an oversight.
create policy "household_members_update" on public.household_members
  for update to authenticated
  using (
    household_id = public.get_my_household()
    and (profile_id is null or profile_id = (select auth.uid()))
  );

-- Only placeholder rows can be deleted via the app — a linked row's
-- lifecycle should track the real account, not be manually removable.
create policy "household_members_delete" on public.household_members
  for delete to authenticated
  using (household_id = public.get_my_household() and profile_id is null);

-- Auto-create (or re-link) a roster row whenever someone actually joins
-- a household — this is what makes every real signed-in user show up
-- in the roster automatically, without a separate manual step.
create or replace function public.sync_profile_to_household_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is not null
     and (old.household_id is distinct from new.household_id) then
    insert into public.household_members
      (household_id, profile_id, display_name, color, role, phone, email, dietary_restrictions)
    values
      (new.household_id, new.id, new.display_name, new.color, new.role, new.phone, new.email, new.dietary_restrictions)
    on conflict (profile_id) do update set
      household_id = excluded.household_id;
  end if;
  return new;
end;
$$;

create trigger on_profile_household_set
  after update of household_id on public.profiles
  for each row execute function public.sync_profile_to_household_members();

-- Retarget assigned_member / logged_by columns from profiles to the
-- new roster table, so a chore, grid block, appointment, or hobby-log
-- entry can be assigned to a placeholder kid, not just a real login.
alter table public.chore_library drop constraint chore_library_assigned_member_fkey;
alter table public.chore_library
  add constraint chore_library_assigned_member_fkey
  foreign key (assigned_member) references public.household_members(id);

alter table public.weekly_blocks drop constraint weekly_blocks_assigned_member_fkey;
alter table public.weekly_blocks
  add constraint weekly_blocks_assigned_member_fkey
  foreign key (assigned_member) references public.household_members(id);

alter table public.appointments drop constraint appointments_assigned_member_fkey;
alter table public.appointments
  add constraint appointments_assigned_member_fkey
  foreign key (assigned_member) references public.household_members(id);

alter table public.hobby_log drop constraint hobby_log_logged_by_fkey;
alter table public.hobby_log
  add constraint hobby_log_logged_by_fkey
  foreign key (logged_by) references public.household_members(id);
