# Deliberate Living — Weekly Planner (Next.js)

The frontend layer for the household planner. Pairs with the `supabase/`
migrations in the parent repo — this app is the UI, that's the database.

## Status: Connected to a real, live Supabase project

Project `deliberate-living-planner` (`us-east-2`, Free tier) is live and
migrated. `.env.local` in this folder already has the real project URL and
publishable key — `npm install && npm run dev` should work as-is.

**What's genuinely verified against the live project** (via direct SQL
queries through the Supabase MCP connection, not just trusting migration
"success" responses):
- All 7 migrations applied and independently confirmed present in
  `list_migrations` (0003 silently failed to register on the first attempt
  despite reporting success — caught by checking migration history
  directly, not by trusting the response)
- RLS enabled on every table that should have it, confirmed via
  `pg_class.relrowsecurity`, not assumed
- All expected policies exist, confirmed via `pg_policies` row counts
  matching what was designed
- Supabase's own security advisor run and all findings resolved — including
  one where the *first* fix attempt didn't actually work on the live
  project (a `REVOKE ... FROM PUBLIC` that succeeded locally but not
  against Supabase's platform, which grants `anon`/`authenticated`
  execute directly on new functions, separate from the `PUBLIC` grant —
  caught by checking `has_function_privilege()` directly rather than
  trusting the advisor's re-scan)
- Performance advisor run, all 19 flagged unindexed foreign keys fixed and
  confirmed via `pg_indexes`, all 4 flagged RLS performance issues fixed

**What's still genuinely unverified**: the actual Next.js app talking to
this live database through a running dev/prod server. The sandbox this was
built in can reach the Supabase MCP tools (which is how all the database
verification above happened) but cannot make outbound network calls to
`supabase.co` from the app's own runtime — so `npm run dev` connecting,
logging in, and the Weekly Grid/Pantry pages actually loading live data
has not been exercised end-to-end. That's the next real check once this
runs somewhere with normal internet access.

What's built and **verified working** (real `next build`, zero errors, plus
unit-tested business logic):
- Magic-link auth (Supabase Auth) — `/login`, `/callback`
- Onboarding — create a household or join one via ID — `/onboarding`
- Protected route shell with tab nav — `app/(app)/layout.tsx`
- **Weekly Grid** — click any block, edit it, writes straight to Supabase
- **Pantry & Meals** — editable pantry with par-level tracking, saved
  recipes with dietary-restriction filtering (hard-excludes `avoid_always`
  matches, soft-flags `prefer_not`), 3-slot weekly meal picks, an
  auto-computed shopping list, and an AI suggestion button wired to a
  server-side API route (`app/api/ai-suggest/route.ts`) — the Anthropic key
  never reaches the browser, unlike the original HTML prototype's pattern

Not yet built, per the agreed order: Chores (auto-recurring, process
steps), Members, Monthly/Yearly Outlook.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in a real Supabase
   project's URL and anon key (Settings -> API in the Supabase dashboard).
2. `npm install`
3. `npm run dev`

## A few things worth knowing before you pick this up

- **Fonts**: currently loaded via `<link>` tags in `app/layout.tsx`, not
  `next/font/google`. This was a workaround for a sandboxed build
  environment without internet access to Google Fonts -- not a real
  constraint on Vercel. Next.js's linter flags the current approach as an
  anti-pattern; switching back to `next/font/google` is a quick fix once
  this is building somewhere with normal internet access. Details in a
  comment at the top of `layout.tsx`.
- **`middleware.ts` -> `proxy.ts`**: already migrated to Next.js 16's current
  convention (the old name is deprecated as of 16, though still functional).
  If you're used to seeing `middleware.ts` in Next.js projects, that's why
  it's not here.
- **Onboarding is intentionally basic**: "join a household" takes a raw
  household UUID, not an invite code. Per the plan doc, real invite-code
  infrastructure is deferred until a third family actually needs it -- this
  is enough for the two real households using this today.
- **This has not been connected to a real Supabase project yet.** Every
  migration was tested against a local/disposable Postgres, not a live
  Supabase instance -- creating the actual project is a separate step
  (see the parent repo's `README.md`), deliberately not done automatically
  since project creation can have cost implications worth confirming first.

## Verification performed before this was handed off

- `npx tsc --noEmit` -- zero type errors
- `npm run build` -- real production build, all 8 routes compile
  (`/`, `/login`, `/callback`, `/onboarding`, `/grid`, `/pantry`,
  `/api/ai-suggest`), proxy correctly recognized
- `npx eslint .` -- zero errors, one documented warning (see Fonts above)
- **New migration (0004) tested the same way as 0001-0003**: ran against a
  disposable local Postgres, plus a functional test confirming the new
  `ingredient_substitutions` table, `dietary_restrictions`, and recipe
  rating/calorie fields actually work end-to-end for a real household --
  caught and fixed one real bug this way (a missing `GRANT` on the new
  shared table, the same class of mistake caught once before on the
  original schema).
- **The dietary-restriction matching logic was unit-tested directly**
  (8 test cases covering hard-exclude vs. soft-flag, hidden gluten sources
  via the substitutions table, and -- caught by the tests, not assumed --
  a real singular/plural matching bug where "Red onion" didn't match a
  restriction on "onions" under naive substring matching. Fixed with
  word-level comparison; all 8 tests pass after the fix.

What this build verification **couldn't** cover: actually exercising the
Supabase queries or the AI suggestion route against live services, since no
real Supabase project or Anthropic API key exists in the environment this
was built in. The code follows the tested schema patterns and Anthropic's
documented request shape, but "compiles and matches the docs" isn't the same
claim as "confirmed working against live data" -- that check happens once
real credentials are connected.
