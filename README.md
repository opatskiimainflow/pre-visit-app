# PreVisit

AI pre-visit notes for small clinics. A patient answers a short questionnaire before the
appointment; the doctor gets a structured note (chief complaint, history, medications,
allergies, red flags) on a daily dashboard.

**Live demo:** https://previsit.opasnuu.workers.dev/login (one-click sign-in as patient, doctor or clinic admin; data resets nightly)

> Portfolio demo. Not a medical device and does not provide diagnoses. All demo data is fictional.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 ·
Supabase (Auth + Postgres with Row Level Security) · Cloudflare Workers via OpenNext ·
LLM for note generation · Webflow for the marketing site.

## Roles

| Role         | Sees                                                        |
| ------------ | ----------------------------------------------------------- |
| Patient      | Books from doctors' free slots, cancels, fills the questionnaire, keeps date of birth/sex up to date |
| Doctor       | Own schedule, answers, AI note (edit), private notes, completes visits |
| Clinic admin | Books and cancels visits, sees the patient list, manages doctors and hours, edits the questionnaire |

Access is enforced in the database with RLS (`supabase/schema.sql`), not only in the UI:
each clinic sees only its own data and patients never see the AI note.

## Setup

1. **Install:** `npm install`
2. **Supabase:** create a project, then in *SQL Editor* run `supabase/schema.sql`,
   then `supabase/migrations/002_visits_and_editing.sql` (booking, visit status, note editing)
   and `supabase/migrations/003_self_booking.sql` (doctors' hours, free slots, patient self-booking)
   and `supabase/migrations/004_doctor_management.sql` (admins add doctors and edit their hours)
   and `supabase/migrations/005_patient_details.sql` (patient date of birth and sex).
3. **Demo users:** in *Authentication → Users → Add user* create (with *Auto Confirm*, same password):
   `patient@demo.previsit.app`, `doctor@demo.previsit.app`, `admin@demo.previsit.app`.
   Then run `supabase/seed.sql`: it creates `public.reset_demo()` and fills the demo clinic.
   Run `supabase/demo-cron.sql` to reset the demo every night at 03:00 Kyiv time (pg_cron),
   so visits are always dated today/tomorrow and the patient questionnaire is empty again.
4. **Env:** copy `.env.example` → `.env.local` and fill in the values.
5. **Run locally:** `npm run dev` → http://localhost:3000

## Deploy to Cloudflare Workers

Every push to `main` is built and deployed by **Cloudflare Workers Builds**
(build: `npx opennextjs-cloudflare build`, deploy: `npx opennextjs-cloudflare deploy`;
`NEXT_PUBLIC_*` are set as build variables). Manual deploy from your machine:

```bash
npx wrangler login                      # once
npx wrangler secret put DEMO_PASSWORD   # once; server-only secret
npm run deploy                          # build + deploy
```

`NEXT_PUBLIC_*` values are read from `.env.local` at build time.
`npm run preview` runs the production build locally in the Workers runtime
(copy `.dev.vars.example` → `.dev.vars` first).

### Why there is no `proxy.ts`

In Next.js 16 `proxy.ts` (formerly middleware) runs on the Node.js runtime, which is still
experimental on Cloudflare Workers. Instead, pages check the role on the server
(`requireRole` in `src/lib/auth.ts`) and the browser Supabase client keeps the session fresh
(`src/components/session-refresher.tsx`).

## Render smoke test

Catches runtime errors that `next build` can't (e.g. calling a client function on the server):
builds against a fake Supabase and renders every page as every role.

```bash
echo NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 > .env.production.local
echo NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub >> .env.production.local
node scripts/smoke/stub-supabase.mjs &
npx next build && npx next start -p 3100 &
node scripts/smoke/render-all.mjs http://127.0.0.1:3100
rm .env.production.local   # don't deploy with the stub URL
```
