# Next.js Frontend Layer — Architecture Sketch

Companion doc to the Supabase schema scaffold. This is a plan, not built code —
covers what the frontend needs before writing it.

## What Next.js does, briefly

A React framework that adds file-based routing, server-side data fetching
("Server Components"), and backend API routes, all in one project — and
deploys straight from GitHub via Vercel. It's the piece that turns the current
single HTML file (client-only, no login, no server, no secrets storage) into
a real multi-user app.

## Proposed project structure

```
app/
  layout.tsx                 root layout — wraps everything in the Supabase session provider
  page.tsx                   landing page (redirects to /login or /grid)

  (auth)/
    login/page.tsx           magic-link email form
    callback/route.ts        Supabase auth callback — exchanges the emailed link for a session
    onboarding/page.tsx      "create a household" / "join a household" — the flow the schema supports

  (app)/                     everything behind login, protected by middleware
    layout.tsx               tab nav + member filter bar (shell)
    grid/page.tsx            Weekly Grid tab
    pantry/page.tsx          Pantry & Meals tab
    chores/page.tsx          Chores tab
    members/page.tsx         Members tab
    outlook/page.tsx         Monthly/Yearly Outlook — aggregated time across workouts/chores/hobbies/appointments

  api/
    ai-suggest/route.ts      server-side route wrapping the meal-suggestion call —
                              this is where a real Anthropic API key lives (server env var,
                              never sent to the browser, unlike the current artifact pattern)

lib/
  supabase/
    client.ts                browser Supabase client (for client components)
    server.ts                server Supabase client (reads the session cookie)
  weekUtils.ts                Monday-of-week math, ported from the current HTML's isoMonday()

components/
  WeeklyGrid.tsx
  PantryTable.tsx
  ShoppingList.tsx
  ChoreLibrary.tsx
  ChoreWeekView.tsx
  MemberFilterBar.tsx
  ...

middleware.ts                 redirects unauthenticated requests to /login
```

## Key packages

| Package | Purpose |
|---|---|
| `next`, `react`, `react-dom` | the framework itself |
| `@supabase/supabase-js` | Supabase client |
| `@supabase/ssr` | cookie-based auth sessions across server + client (replaces the old auth-helpers package) |
| `tailwindcss` | styling — the current dark navy/brass/JetBrains-Mono design translates directly into a Tailwind theme config |
| `date-fns` (optional) | week/date math, though the current hand-rolled `isoMonday()` logic also just ports over |

## Auth flow

1. User enters email on `/login` → Supabase sends a magic link.
2. Clicking the link hits `/callback`, which exchanges the code for a session and sets it in a cookie via `@supabase/ssr`.
3. `middleware.ts` checks that cookie on every request to `(app)/*` — no session, redirect to `/login`.
4. First-time users land on `/onboarding` to create a new household or join an existing one via invite code — a real flow now that this serves multiple families, not a manual SQL step.

## Data layer — what changes from the current HTML prototype

| Current (HTML artifact) | Next.js version |
|---|---|
| `window.storage.get/set(key, shared)` | `supabase.from('table').select()` / `.insert()` / `.update()`, scoped automatically by RLS |
| Manual reload on week navigation | Same query pattern, but can add `supabase.channel().on('postgres_changes', ...)` for live sync — changes from your wife's device appear without a reload |
| AI suggestion: direct `fetch()` to Anthropic from the browser | `fetch('/api/ai-suggest')` → server route calls Anthropic with a server-held key |
| No login — anyone with the link edits everything | Real per-person accounts, enforced by the RLS policies already built and tested |

Everything else — the auto-recurring chore logic, the shopping list math, the
color-coded member tagging, the visual design — carries over conceptually
unchanged; it's the same logic, just reading/writing Supabase instead of
`window.storage`.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=          # safe to expose — protected by RLS, not secrecy
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # same

ANTHROPIC_API_KEY=                 # server-only, used in app/api/ai-suggest/route.ts
# Later, if scheduled reminders get built:
TWILIO_ACCOUNT_SID=                # server-only
TWILIO_AUTH_TOKEN=                 # server-only
RESEND_API_KEY=                    # server-only (email)
```

## Deployment

1. Push this repo to GitHub (alongside the `supabase/` folder from the schema scaffold).
2. Connect the repo in Vercel — auto-deploys on every push to `main`.
3. Set the environment variables above in the Vercel dashboard (not in the repo).
4. Add a PWA manifest so it installs to the iPhone home screen like a native app.

## Decisions (resolved)

- **Next.js version**: 16.x (current stable, confirmed via search — 16.3.0 as of writing). Built on React 19, Turbopack default. Next.js 14 is legacy at this point; no reason to start there.
- **Keeping it updatable**: Dependabot enabled on the GitHub repo opens a PR whenever Next.js (or any dependency) has a new version. Patch/minor updates are low-risk to merge quickly; major version bumps use Next.js's official codemod tool (`npx @next/codemod upgrade latest`) plus a test pass before merging. This is a real update path — the current HTML artifact has none.
- **Build order**: incremental — Weekly Grid first, then Pantry & Meals, then Chores, then Members, then Monthly Outlook (below). Each tab is independently useful the moment it ships.

## Multi-family onboarding (scope change)

This will be used by several families, not just one household — which changes onboarding from "skip it" to real product surface:

- **Database layer needs no rework.** The `households` + RLS design was already built and tested as if multiple independent households would use it (see the RLS test in the schema scaffold — two simulated households, verified zero cross-visibility).
- **New UI needed**: a signup + invite flow.
  - `app/(auth)/onboarding/page.tsx` — "Create a household" or "Join a household via invite code"
  - Consider adding an `invite_code` column (short random string) to `households` in a future migration, so joining doesn't require sharing a raw UUID.
- **Before opening this to other families**: a short privacy/terms note, particularly given health data is going to live here. Doesn't need to be elaborate, but shouldn't be skipped once it's not just your own household's data.

## New feature: Monthly / Yearly Outlook

Decided against duplicating what a phone already tracks (steps, water, workouts via a fitness app) — instead, the Outlook aggregates **time and activity already flowing through the planner itself**: workouts, chores, hobbies, appointments, meal-prep consistency. No separate health-metrics table; a small addition to what already exists.

**What it rolls up, month and year views:**
- Time spent per category (workouts, chores, hobbies, appointments) where duration is logged
- Raw completion counts where it isn't ("6 workouts this month" as a fallback)
- Hobby completion rate (`hobby_log` vs `hobbies.target_per_month`)
- Chores completed vs scheduled (`chore_instances`)
- Appointments kept (`appointments`)
- Meal-prep consistency (weeks with all 3 `meal_plan` slots filled)

**Schema change (design sketch, not yet migrated):**
```sql
alter table public.weekly_blocks add column duration_minutes int;
alter table public.chore_instances add column duration_minutes int;
alter table public.hobby_log add column duration_minutes int;
```
All nullable and optional — logging a duration when you mark something done is a bonus, not a requirement.

**Aggregation query pattern** (repeated across `weekly_blocks`, `chore_instances`, `hobby_log`, unioned into one view):
```sql
select
  date_trunc('month', week_start) as month,
  type,
  count(*) as instances,
  sum(duration_minutes) as total_minutes
from public.weekly_blocks
where household_id = :household_id
group by 1, 2
order by 1 desc;
```

## /grill-me session — decisions log

Working through a stress-test interview on this plan surfaced real changes worth capturing before they're lost to scroll-back.

### V1 scope — the actual cut line
There is one real household beyond your own committed to using this today
(not a hypothetical). That justifies keeping the multi-tenant RLS foundation
(already built and tested — costs nothing to leave in place), but NOT
building the invite-code UI / onboarding polish yet — that's effort spent on
a future third family, not the real second one waiting now. Onboard them
manually via the SQL flow already tested in the schema scaffold.

**Resolved: Grid-as-shell vs. Recipes-as-priority isn't actually a conflict.**
Weekly Grid has to exist first, but as the *infrastructure* both features
need — auth, layout, tab navigation — not because it outranks Recipes as a
finished feature. Once that shell exists:

1. **Shell first** (unavoidable either way): auth, layout, nav, Weekly Grid tab.
2. **Pantry + Recipes + dietary restrictions next** — immediately after the
   shell, ahead of Chores/Members/Outlook/Quotes — because that's the piece
   the second family actually needs, confirmed real and load-bearing.
3. **Everything else** (Chores-as-projects, auto-recurrence, Outlook, quotes)
   trails behind both, and deliberately isn't over-planned further right now —
   avoiding exactly the "monthly-outlook decision paralysis" concern raised
   here: nail the weekly core before designing further out.

### AI — two different features, not one
"Minimize AI use, work offline" and "she needs daily cooking help" sounded
contradictory until split into what they actually are:

1. **Library authoring (one-time, offline forever after)**: use AI *once* as
   an authoring tool to batch-generate a few hundred recipes/workouts/quotes.
   Zero ongoing cost or network dependency after that — it's just data.
2. **Pantry matching (the actual daily need — no AI required)**: "which saved
   recipe fits what's in my pantry right now" is deterministic ingredient
   overlap against the library from #1. Pure math, instant, works offline.
   Also surfaces **near-miss recipes** — "you're 2 ingredients away from X" —
   directly useful for "what should I grab at the store."
3. **Live AI fallback (rare)**: only when nothing in the library fits well
   and something genuinely new needs inventing. This is the only case that
   can't be pre-computed, since it's reacting to today's specific pantry.

Net effect: the live AI dependency shrinks from "constant" to "rare edge
case," and almost everything she touches day-to-day works with no network.

### Recipe rating system
Each library recipe (authored in the one-time AI batch pass above) gets:
- **Stars (1-5)**: healthiness — a documented rubric (e.g., protein density,
  fiber, vegetable content, added sugar/sodium) applied consistently during
  authoring, not left to per-recipe AI judgment at suggestion time.
- **Chili peppers (1-3)**: spice level.
- **Serving-size multipliers by group** (adult male / adult female / child) —
  base recipe scales by who's actually eating, not just a flat "serves 4."

### Dietary restrictions
Confirmed real, not hypothetical — across the two households: onions,
cheese, and gluten among others. These aren't all the same *kind* of
restriction (gluten is likely an intolerance/allergy — a hard exclude;
onions is more likely a preference — a soft deprioritize), so the schema
needs to carry that distinction, not just a flat list:

```sql
alter table public.profiles add column dietary_restrictions jsonb not null default '[]'::jsonb;
-- each element: {"item": "gluten", "severity": "avoid_always"}
--            or: {"item": "onions", "severity": "prefer_not"}

create table public.ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  original_ingredient text not null,     -- e.g. "all-purpose flour"
  restriction text not null,             -- e.g. "gluten"
  substitute text not null,              -- e.g. "1:1 gluten-free flour blend"
  notes text
);
```

Matching behavior: `avoid_always` items **hard-exclude** a recipe from
suggestions entirely — no exceptions, no "5 stars but contains gluten"
half-measures. `prefer_not` items lower a recipe's ranking but don't hide it.
Both the deterministic pantry-matcher and the rare live-AI fallback filter
against this before anything else — restriction-checking happens first,
rating/spice/serving-size personalization happens after.

**Accuracy — best effort, explicitly disclosed, not silently assumed
perfect.** Tagging is only as good as the information available, and the app
says so in the UI wherever restriction-filtered results are shown (e.g., "Best-effort
filtering based on listed ingredients — always verify for medical dietary
needs"). To make that best effort actually good, the AI authoring/review pass
should be grounded against real reference material for hidden sources, not
just general knowledge — e.g. the [Celiac Disease Foundation's gluten-source
list](https://celiac.org/what-is-gluten/sources-of-gluten/) explicitly flags
non-obvious sources like malt, brewer's yeast, soy sauce, and roux-based
sauces, which a naive tagging pass is exactly the kind of thing likely to
miss. **Cross-contact (shared toasters, fryers, cutting boards) is a kitchen-
practice problem, not a recipe-data problem — no tagging system can address
it, and the app shouldn't imply otherwise.**


### Pantry quantity entry — units, calories, and barcode scanning
When checking off a shopping-list item, capture the actual amount with a
unit selector (lb / kg / g / oz), defaulting to the par-level quantity for
whoever doesn't want to bother with precision. This both fixes the
checkbox-does-nothing bug above *and* enables calorie/serving math, since
that requires a real quantity in a known unit, not just "bought: yes."

**Barcode scanning — real assessment**: technically buildable without a
native app — browser camera access + a barcode-decode library, paired with
[Open Food Facts](https://world.openfoodfacts.org) (free, open, barcode →
ingredients/nutrition/allergens, no custom database to maintain). But it only
covers *packaged* goods — the majority of the seed recipes' ingredients
(onions, garlic, sweet potatoes, fresh chicken) have no barcode at all, so
manual entry remains mandatory for most real use, not just a lazy-path
fallback. **Verdict: real V2 enhancement, not a V1.1 blocker.**

### Calories — recipe-level, not ingredient-level
Confirmed as a real need (not a guess), but scoped deliberately light:
**recipe-level approximate calories-per-serving**, authored once during the
same AI batch pass as stars/chilis — not computed from ingredient-level
nutrition math. Simpler schema (`calories_per_serving int` on `recipes`,
nothing new on `recipe_ingredients`), no unit-conversion dependency for
calorie display specifically. A per-profile settings toggle hides it for
anyone who'd rather not see calorie numbers — the right default for
something this personal, not an afterthought.

### Support & failure expectations — open item, not yet resolved
Same model as HoD: James is de facto tech support, building/debugging
alongside Claude. Realistic and consistent with how the other project
already runs. **But the other family hasn't discussed what happens when it
breaks** — that conversation hasn't happened yet, only assumed. Doesn't need
to be formal, just explicit before they're relying on it for dinner: rough
expectation on fix turnaround, and what their fallback is when it's down.
Cheap mitigation regardless of whether that conversation happens: Vercel's
built-in error monitoring + a Supabase dashboard alert on failed queries —
both free on the stack already chosen, so "know when it's broken" costs
nothing extra even if "fix it instantly" isn't realistic for a side project.

### Monetization horizon — same model as HoD, cheap to prep for now
James absorbs costs while the user base grows organically ("more people
and/or leagues"), with an eventual free tier + paid tier (some sections
hidden) once growth justifies it — mirroring the HoD pattern. Architecturally
cheap to prepare for without building anything yet: add a
`households.plan text default 'free'` column now (near-zero cost, no
behavior change), and defer all actual feature-gating logic, billing
integration, and ToS/refund questions until there's a real reason to build
them. **Worth being clear-eyed about later, not now**: "friends using
something for free" and "paying subscribers" are categorically different
commitments — real customer support expectations, legal terms, payment
processing, churn — not just a bigger version of the same side project. Not
a blocker today, but a real conversation whenever a second household would
actually be asked to pay.

**Free/paid boundary: genuinely undecided, deliberately deferred** — rather
than guessing now, the plan is to let real usage data show what people
actually want more of before drawing that line. Consistent with the
recommendation above (whatever it ends up being, it shouldn't be the thing
that made the validated user say yes in the first place).

### Kiosk auth — stay logged in, alert admin on failure
Intent: kiosk-style displays (tablet/monitor) should stay signed in
indefinitely, not force periodic re-login — Supabase's refresh-token
mechanism already does this by default (the client auto-refreshes as long as
the session is active), so this is mostly "don't fight the default," not new
engineering. Personal devices (phone/desktop, for adding/editing) can keep
normal magic-link re-auth, since occasional re-login there is a minor
inconvenience, not a broken kiosk.

**Real risk worth flagging, specific to this exact use case**: if the kiosk
is an iPad running Safari, iOS's Intelligent Tracking Prevention can purge a
site's local storage after roughly a week of *no direct touch interaction* —
which is exactly what a glance-only, no-touch display is. A dedicated
Android tablet or a desktop monitor doesn't have this specific failure mode.
Mitigations, not yet chosen between: (a) design at least one small
interaction into the daily glance (checking off a block) so the tablet
counts as "used," (b) accept the risk on iPad specifically and lean on
alerting to catch it, or (c) prefer non-Safari/non-iPad hardware for the
kiosk role specifically.

**Admin alerting**: a scheduled Vercel Cron Job / Supabase Edge Function
periodically verifies each household's kiosk session is still valid, and
emails James if one has silently died. This is genuinely appropriate backend
automation now that this runs on real infrastructure — unlike the earlier
client-side HTML artifact, which had no mechanism for this at all.

### Free vs Pro — does it affect how we build?
Asked directly, worth having the answer on record: **no.** Schema, RLS
policies, and app code are identical regardless of plan tier — nothing here
is written differently "for Pro." The tier only affects operational
concerns (backups, auto-pause, resource ceilings) and one workflow detail
(Supabase branching requires Pro — irrelevant here since local Postgres is
already the tested migration-verification method). Decision: keep building
on Free as planned, upgrade to Pro at the point already agreed on — once
real families depend on this daily, not before. The upgrade itself is a
dashboard action on the existing project, not a rebuild.

### Backups & migration safety — researched, not assumed
Verified current Supabase pricing/behavior (not guessed):
- **Free tier**: no automated backups, no PITR, auto-pauses after 7 days
  idle. A bad migration against real data has no native undo.
- **Pro ($25/mo)**: daily backups, 7-day retention, included automatically.
- **PITR add-on**: $100/mo per 7-day retention window, on top of Pro — real
  money, and more precision than this project needs (undo yesterday's
  mistake, not rewind to 2:47pm).

**Decision**: Pro tier is worth it once real families' data lives here —
daily backups cover the realistic failure mode. Skip PITR.

**Staging for migrations**: Supabase branching (~$0.01344/branch-hour, so a
full month of one branch left running ≈ $9.70) — spin up an isolated copy,
test the migration, tear it down, rather than doubling permanent storage
with a second full project. One real caveat: branches start empty, not
seeded with production data, so "test against realistic data" still means
maintaining a seed script, not something branching gives for free. Every
migration from here forward gets tested this way before touching production
— the same discipline that caught the two real RLS bugs in the original
schema, just against a disposable branch instead of a local Postgres install.

### Forward meal planning

`meal_plan` already supports picking a *future* week's slots, not just the
current one — so "plan next week Sunday, get a grocery list ready by Sunday
morning" is already the existing data model, not a new feature. Worth
confirming the UI actually surfaces "plan ahead" clearly rather than only
showing the current week by default.



- **Color theme**: one shared theme for the whole household — the existing dark navy/brass design carries over as-is. No per-member theming work needed for v1.
- **Daily quotes**: a broad mix — religious, literary, philosophical, motivational. Design approach:

**Schema (design sketch, not yet migrated):**
```sql
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text,
  source_type text not null check (source_type in ('religious','literary','philosophical','motivational')),
  day_of_year int  -- 1-366, optional fixed assignment; null = eligible any day
);
```
Rotation is deterministic — `extract(doy from current_date)` picks the day's quote from a pre-seeded table, so it works offline, costs nothing, and never repeats within a year without relying on a live API call. Seeding ~150-365 quotes across the four categories is a content task, not a code task — happy to draft a starter set spanning traditions/genres when we get to building this, or you can supply a curated list if you have sources in mind.

*(An AI-generated-fresh-daily version is possible too, using the same server-route pattern as the meal suggestions — but it adds a live dependency and small ongoing cost for something a static rotation already solves well. Worth reconsidering only if the static list starts feeling repetitive.)*

