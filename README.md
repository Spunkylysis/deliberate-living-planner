# Deliberate Living Planner — Supabase Schema + App

Database and frontend for turning the HTML planner prototype into a real
multi-user app with proper login and per-household data isolation.

**Live project**: `deliberate-living-planner`, `us-east-2`, Free tier, all
7 migrations applied and verified. See `app/README.md` for exactly what's
been confirmed against the live database vs. what's still unverified.

## What's in here

```
supabase/migrations/
  0001_core_auth.sql              households + profiles, signup trigger, get_my_household()
  0002_planner_schema.sql         pantry, recipes, weekly grid, chores, appointments, etc.
  0003_rls_policies.sql           Row Level Security — every table scoped to the caller's household
  0004_pantry_recipes_extras.sql  dietary restrictions, recipe ratings/calories, substitutions
  0005_security_hardening.sql     RLS on ingredient_substitutions, function EXECUTE hardening
  0006_fix_function_privileges.sql  correction to 0005 — Supabase grants roles directly on new
                                     functions, "REVOKE FROM PUBLIC" alone wasn't enough
  0007_performance_indexes.sql    indexes on all FK columns, RLS auth.uid() re-evaluation fix
app/
  Next.js 16 app — auth, onboarding, Weekly Grid, Pantry & Meals (see app/README.md)
.github/workflows/
  deploy-migrations.yml   auto-runs `supabase db push` when a migration file changes on main
```

## Why this is a separate Supabase project from HoD

The Fantasy Baseball / HoD Decision Engine project uses a single shared anon
key with `USING (true)` policies — fine for a 28-person league where everyone
is trusted to see everyone else's data. A household planner holds real
personal schedules, so this uses actual Supabase Auth (magic-link email login)
with Row Level Security that mathematically prevents one household from ever
reading or writing another's data — verified by a local test (see "How this
was tested" below), not just assumed.

## Setup

1. **The Supabase project already exists** — connection details are in
   `app/.env.local`. Skip to step 2 unless setting this up fresh elsewhere.
2. **Enable email auth**: Authentication → Providers → Email → make sure magic
   link / OTP is on. No password needed.
3. **Run the migrations**, either:
   - Paste each file's contents into the SQL Editor in order (0001, 0002, 0003), or
   - Use the Supabase CLI locally: `supabase link --project-ref <ref>` then `supabase db push`
4. **Set up GitHub Actions** (optional, for auto-deploy on push): add these repo secrets —
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`.

## Onboarding flow (how a household gets created)

There's no signup UI yet, but the flow the schema supports is:

1. Person signs up via Supabase Auth (magic link) → `handle_new_user()` trigger
   automatically creates their `profiles` row.
2. First person in a household: `INSERT INTO households (name) VALUES (...)`,
   then `UPDATE profiles SET household_id = <new id> WHERE id = auth.uid()`.
3. To invite others: share the `household_id` (or a nicer invite-code flow,
   which would be a frontend feature) — they sign up, then run the same
   `UPDATE profiles SET household_id = ...` to join.

## How this was tested

Before handing this off, I installed Postgres locally, stubbed the parts of
Supabase Auth these migrations depend on (`auth.users`, `auth.uid()`), ran all
three migrations against a clean database, and then ran a functional test
simulating two separate households:

- Confirmed the signup trigger auto-creates a profile
- Confirmed a user can create a household and add data to it
- **Confirmed a second household's user gets zero rows back** when querying
  the first household's pantry items or the household record itself
- **Confirmed a direct attempt to insert data into another household's
  `household_id` is rejected by RLS**, not just hidden from view

This caught two real bugs in the first draft, both fixed in the current
version:
- `INSERT ... RETURNING` on a brand-new household failed, because Postgres
  checks the row against the `SELECT` policy too, and a brand-new household
  isn't yet linked to its creator's profile. Fixed by adding `created_by` to
  `households` and allowing the creator to see their own row via that column.
- A user couldn't see their own profile before joining a household, because
  the policy compared `household_id = get_my_household()`, and `NULL = NULL`
  is never true in SQL. Fixed by adding `OR id = auth.uid()`.

Neither of these would have surfaced from just reading the SQL — they only
show up when you actually run the onboarding sequence.

## What's next (not in this scaffold)

- **A frontend.** This is schema only. The natural next step is a small
  Next.js app (or similar) using `@supabase/supabase-js` for auth + data, and
  Supabase Realtime so edits sync live across devices instead of the
  reload-on-navigation pattern in the current HTML prototype.
- **Scheduled reminders** (e.g., automatic Sunday-night texts) would use a
  Supabase Edge Function + `pg_cron`, calling Twilio/Resend with secrets held
  server-side — never exposed to the browser.
- **An invite-code flow** so household_id doesn't have to be shared as a raw
  UUID.

## GitHub's role here

Worth being specific about this, since "add it to GitHub" can mean different
things:

- **Version control for the schema** — every migration is a reviewable diff,
  and you can see exactly when a policy changed and why.
- **The GitHub Action here auto-deploys migrations** the same way the
  `github-actions-etl` skill's cron pattern auto-deploys the Fantrax ETL —
  push a new migration file, it lands in Supabase without a manual step.
- **It becomes essential once there's a frontend** — a Next.js app deployed
  via Vercel connects directly to a GitHub repo for auto-deploy on push,
  so the earlier this lives in GitHub, the smoother that transition is.
- It's optional for the SQL alone — you could run these migrations by hand
  forever. It starts paying for itself once more than one person is editing
  the schema, or once app code shows up alongside it.
