# Creative OS private prototype deployment

This release adds Supabase email/password login and one private workspace per login. Leads, drafts, tags, process records and activity are stored together as a versioned JSON document. It is a prototype persistence layer, not a multi-user CRM backend. Reload to load another device's changes. A stale save is rejected and must be reconciled using export/restore. No Gmail connection, Gmail token storage, sends, scheduled worker or warm-up exists yet.

## 1. Supabase

1. Run `../../supabase/migrations/202611140001_workspace.sql` once in SQL Editor. It creates only the Creative OS table, read policy and save function; it does not alter existing tables. A repeated run errors rather than resetting existing data.
2. In Authentication settings, disable new user sign-ups for this private test. Keep the Email provider enabled.
3. In Authentication → Users, use Add user → Create new user to create your own test login with email and a strong password. Use the confirmed-user option if presented. This is a Creative OS login, separate from your Supabase dashboard and Gmail credentials. Do not share the password with an assistant or commit it.
4. Keep the Project URL (without `/rest/v1/`) and publishable key for Vercel. No secret/service-role key is needed in this release.

## 2. GitHub and Vercel

Import `ProductDesigner-Ath/Creative-OS` into Vercel only after the cloud-persistence branch has been pushed. Select branch `codex/outreach-layout` for this prototype, or merge it through your normal review workflow before deploying main. Do not deploy an older main branch and assume it contains these changes.

| Setting | Value |
| --- | --- |
| Root directory | `apps/outreach` |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| VITE_SUPABASE_URL | Your HTTPS Supabase Project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Your `sb_publishable_...` key |

Set both variables for the environment you deploy (Production, and Preview if using branch previews). Redeploy after changing variables: Vite embeds public values at build time. Never place the Google OAuth JSON/client secret, database password or Supabase secret/service-role key in a `VITE_` variable. The included Vercel configuration permits only same-origin resources and HTTPS Supabase API connections. No Gmail API connection is implemented.

A public hosted URL shows the sign-in form; records are protected by database policies. Missing hosted configuration displays a setup error instead of entering local demo mode. Source frontend assets/public keys are visible by design. Use Vercel Hobby only while the usage meets its personal non-commercial terms; actual business outreach needs a suitable plan/host.

## 3. Verify before using real data

1. Sign in using your newly created Creative OS login. A new cloud workspace starts empty and does not upload local sample/private records automatically.
2. Add a fictional lead, tag and draft, save, reload and check persistence.
3. Sign in as the same user in another browser/device and verify that record appears. Save there, then attempt to save an old version in the first browser: a conflict should appear with an export action. Export unsaved work, reload, compare, then apply the intended changes manually. Restoring a backup replaces the whole workspace; compare first.
4. Sign out and verify records disappear behind login. A second account should have a separate empty workspace.
5. For existing local records, export a full JSON backup from the original browser and use Settings → Restore backup after signing in. This explicitly uploads those records to Supabase. CSV import is also available.

The publishable key alone cannot read the table. User JWTs are checked by Supabase; clients cannot write the table directly and must use the save RPC with an expected revision. Changes remain in memory on save failure with retry/export and a tab-close warning. No offline cloud editing is supported. Each full document is limited to 8 MiB by the database. Backups and manual conflict resolution are necessary for this initial design.

## 4. Gmail comes next

Keep your Web OAuth client private. Once the hosted URL is confirmed, implement a server callback, encrypted token storage and account binding, then register the actual callback with Google. Do not guess a callback URL or upload Google credentials to frontend assets. Main `satavue.com` remains excluded from outreach senders.

## Local checks

From the repository root:

```sh
npm test
npm run outreach:build
npm --prefix apps/outreach run test:cloud
```

Cloud tests execute the actual migration in embedded PostgreSQL (PGlite), including owner isolation, anonymous denial, direct-write denial, revision conflicts and document bounds. They do not substitute for verifying the hosted Supabase deployment. To test cloud locally, copy `.env.example` to `.env.local` in `apps/outreach`, fill in only public values, then use `npm run outreach:dev`. The legacy loopback production preview deliberately blocks external connections, so use the Vite dev preview for local cloud checks.
