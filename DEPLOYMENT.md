# Deployment — GitHub + Vercel

The repo is already `git init`'d and committed (see `git log` — one commit,
46 files, everything except `.env.local`). This is the exact sequence to
get it live.

## 1. Create the GitHub repo

Go to https://github.com/new and create an empty repo — **do not**
initialize with a README/gitignore/license, since this repo already has
all of those and an extra initial commit would conflict.

Suggested name: `deliberate-living-planner` (or whatever you'd prefer —
doesn't need to match anything already set up).

## 2. Push

From inside the `household-planner/` folder (where this file lives),
run exactly this, swapping in your actual GitHub username and the repo
name you just created:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

That's it for GitHub — the commit that's already there goes up as-is.

## 3. Connect Vercel

1. Go to https://vercel.com/new and import the GitHub repo you just pushed.
2. **Root Directory**: set this to `app` — the Next.js project lives in a
   subfolder (`household-planner/app/`), not the repo root, since the repo
   also holds the Supabase migrations alongside it. Vercel needs to be told
   this explicitly or the build will fail looking for `package.json` in the
   wrong place.
3. **Environment Variables** — add these two (values are in
   `app/.env.local`, which was deliberately never committed to git, so
   Vercel needs them entered manually):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://zlejglbuifcjsdnhqznk.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_uory6hAyVdAyV88nB5nZSA_ja2XIOrd
   ```
4. Deploy.

## 4. What to actually check once it's live

This is the real point of this whole step — the end-to-end path that
couldn't be verified from a sandboxed build environment:

- [ ] Visit the deployed URL, land on `/login`
- [ ] Enter an email, confirm the magic-link email actually arrives
- [ ] Click the link, confirm it redirects through `/callback` into
      `/onboarding` (first-time user, no household yet)
- [ ] Create a household, confirm it lands on `/grid`
- [ ] Click a grid cell, add a block, confirm it persists on page reload
      (this is the real test — confirms writes are actually reaching
      Supabase and RLS is scoping them correctly)
- [ ] Visit `/pantry`, add a pantry item and a recipe, confirm the
      shopping list computes correctly
- [ ] If `ANTHROPIC_API_KEY` gets added to Vercel's env vars too, test the
      AI suggestion button — otherwise it'll correctly show the
      "not configured yet" message from the route's own handling

## Auto-deploy going forward

Once connected, every `git push` to `main` triggers a new Vercel deploy
automatically. The `.github/workflows/deploy-migrations.yml` workflow
handles the *database* side the same way — push a new migration file,
it applies to Supabase — but that one needs its own repo secrets set up
separately (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`,
`SUPABASE_DB_PASSWORD`), documented in the root `README.md`.
