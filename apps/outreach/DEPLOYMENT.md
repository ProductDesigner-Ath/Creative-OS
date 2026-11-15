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

Set both variables for the environment you deploy (Production, and Preview if using branch previews). Redeploy after changing variables: Vite embeds public values at build time. Never place the Google OAuth JSON/client secret, database password or Supabase secret/service-role key in a `VITE_` variable. The included Vercel configuration permits only same-origin resources and HTTPS Supabase API connections. Gmail OAuth uses same-origin server functions; Google tokens are never returned to frontend code.

A public hosted URL shows the sign-in form; records are protected by database policies. Missing hosted configuration displays a setup error instead of entering local demo mode. Source frontend assets/public keys are visible by design. Use Vercel Hobby only while the usage meets its personal non-commercial terms; actual business outreach needs a suitable plan/host.

## 3. Verify before using real data

1. Sign in using your newly created Creative OS login. A new cloud workspace starts empty and does not upload local sample/private records automatically.
2. Add a fictional lead, tag and draft, save, reload and check persistence.
3. Sign in as the same user in another browser/device and verify that record appears. Save there, then attempt to save an old version in the first browser: a conflict should appear with an export action. Export unsaved work, reload, compare, then apply the intended changes manually. Restoring a backup replaces the whole workspace; compare first.
4. Sign out and verify records disappear behind login. A second account should have a separate empty workspace.
5. For existing local records, export a full JSON backup from the original browser and use Settings → Restore backup after signing in. This explicitly uploads those records to Supabase. CSV import is also available.

The publishable key alone cannot read the table. User JWTs are checked by Supabase; clients cannot write the table directly and must use the save RPC with an expected revision. Changes remain in memory on save failure with retry/export and a tab-close warning. No offline cloud editing is supported. Each full document is limited to 8 MiB by the database. Backups and manual conflict resolution are necessary for this initial design.

## 4. Connect outreach Gmail accounts

The Gmail connection is separate from Creative OS sign-in. It requests `openid`, `email` and `gmail.send` only. No inbox read/modify permission, real sending endpoint, warm-up or background job is implemented in this milestone. Connecting is not an authentication/DNS or deliverability test.

1. Run `supabase/migrations/202611140002_gmail.sql` in the existing Supabase project SQL Editor. Both tables are server-only, with RLS and no browser-role privileges. Keep the earlier workspace migration.
2. In Vercel → creative-os → Settings → Environment Variables, add these **server-only** values to **Production only**, then deploy the Gmail branch/main. Do not add them to Preview deployments or prefix them with `VITE_`:

| Variable | Value |
| --- | --- |
| APP_URL | `https://creative-os-drab-five.vercel.app` (no trailing slash) |
| SUPABASE_URL | Existing Supabase HTTPS Project URL |
| SUPABASE_SECRET_KEY | Supabase server secret key (`sb_secret_…`) from Settings → API Keys; legacy service_role also supported |
| GOOGLE_CLIENT_ID | Client ID from the existing Google Web application OAuth client |
| GOOGLE_CLIENT_SECRET | Its client secret |
| GMAIL_TOKEN_ENCRYPTION_KEY | 32 random bytes encoded as base64 |

Generate the encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and paste it directly into Vercel. Do not commit or paste secrets into chat. Losing/changing this key requires reconnecting existing mailboxes; encrypted database backups also require the key. The Supabase secret bypasses RLS: keep it server-only.

3. In the existing Google Cloud project, enable the **Gmail API**. Under Google Auth Platform → Clients → your **Web application** client, register this exact **Authorized redirect URI**:

   `https://creative-os-drab-five.vercel.app/api/gmail/callback`

   This backend OAuth flow needs no JavaScript origin. Keep other existing redirect URIs if another app needs them. Update APP_URL and Google's callback together if using a custom domain later.
4. Check Audience. If **Internal**, both outreach users must be in that Workspace organization. If **External / Testing**, add both actual outreach Google logins as test users. Google may expire testing refresh tokens after seven days for Gmail access; reconnecting is expected in that mode. Public distribution needs the applicable OAuth verification; do not treat a private test as public approval. Add the requested scopes to Data access.
5. Sign into Creative OS → Mailboxes → **Connect Gmail** for each mailbox. Choose that mailbox's own Google account and review/approve the requested permission yourself. Only `sagorika@satavuestudio.com` and `sagorika@withsatavue.com` are accepted; aliases of another primary account will fail identity matching. The main domain cannot be connected.
6. Verify **Connected**, then **Check connection**. This refreshes access on the server without sending or reading mail. Reload and verify the connection persists. The browser receives metadata only. Test another Creative OS login has no access to these connections.
7. **Disconnect** deletes the encrypted token and pending authorization state from Creative OS. It deliberately does not revoke Google's broader grant, which can affect other accounts using the same OAuth client. Remove Creative OS under Google Account → Third-party connections to revoke the Google grant too.

OAuth state expires in ten minutes and is consumed atomically. A Secure HttpOnly SameSite=Lax cookie binds the callback to its starting browser; PKCE binds the authorization code. Google's verified ID token binds the actual mailbox. AES-256-GCM binds each refresh token to its owner and mailbox. Credential tables must never be added to backups exported by the frontend. Expired pending rows are deleted on the owner's next connection attempt; no cleanup scheduler is installed.

No real mailbox connection, token refresh or hosted login test is claimed until the remote configuration and consent steps succeed. Vite dev / the static loopback server do not run the Vercel API functions: test the full OAuth flow on the configured production hostname.

## Local checks

From the repository root:

```sh
npm test
npm run outreach:build
npm --prefix apps/outreach run test:cloud
npm --prefix apps/outreach run test:gmail
```

Cloud tests execute the actual migration in embedded PostgreSQL (PGlite), including owner isolation, anonymous denial, direct-write denial, revision conflicts and document bounds. They do not substitute for verifying the hosted Supabase deployment. To test cloud locally, copy `.env.example` to `.env.local` in `apps/outreach`, fill in only public values, then use `npm run outreach:dev`. The legacy loopback production preview deliberately blocks external connections, so use the Vite dev preview for local cloud checks.

## 5. Reviewed email sending (explicit activation required)

Deploy the reviewed-sending branch only after applying `supabase/migrations/202611150001_outreach_sending.sql` to the existing project. The Gmail/workspace migrations are prerequisites. This migration adds a server-only outbox, persistent suppression table, atomic send-claim RPC and one-way suppression RPC. There are no new browser-role grants. Keep existing Gmail connections and encryption key unchanged.

Add these **Production-only** environment variables to Vercel:

| Variable | Purpose |
| --- | --- |
| OUTREACH_POSTAL_ADDRESS | Real sender postal address to display verbatim in every message footer; maximum 500 characters. Do not invent an address. |
| REVIEWED_SENDING_ENABLED | `true` to explicitly enable manual reviewed sends; absent/any other value keeps review/send endpoints disabled. |

Redeploy after setting these. Keep the sending flag unset in previews. Do not send real leads as part of deployment validation. A later test send requires an explicitly selected recipient and reviewed content.

### User workflow

1. Open a lead, enter a valid recipient, subject and plain-text message, choose email stage **Approved to send** (or **Follow-up due**) and **Save changes**. Lost, Skipped and Won leads cannot send. Sample leads and reserved test domains are rejected.
2. Open **Email workspace**, select the saved draft and one connected outreach mailbox. Click **Review saved draft**. The server loads the saved lead, checks approval/suppression, and creates or reuses an immutable message snapshot including the real sender address and opt-out link.
3. Inspect the entire preview: sender, single recipient, subject and final footer/body. Tick the review confirmation, then explicitly click **Send 1 email**. No tag, import, stage edit, draft save or mailbox connection sends mail.
4. The database rechecks the saved draft/approval, connected mailbox, persistent suppression and rate limits before atomically claiming the snapshot. Reviews expire after ten minutes. A changed draft must be reviewed again. Each snapshot can be claimed once, including across tabs.
5. **Accepted by Gmail** records a Gmail message ID, not inbox placement or confirmed delivery. History stores the latest 100 reviews/attempts in the UI. The backend retains all records; limits use the full table.

### Limits and failure handling

The app limits each outreach mailbox to **20 attempts per rolling 24 hours**, with **60 seconds minimum spacing**, aggregated across workspace owners using that mailbox. This is an app safeguard, not Google's quota or a proven deliverability threshold. All claims count toward the cap, including unknown outcomes. Gmail can impose stricter limits.

There is exactly one Gmail network submission per claimed review, using built-in fetch without automatic retries. Timeout, provider errors and malformed provider responses are recorded as **Uncertain**. A server interruption can leave **In progress**. If the Gmail response was accepted but recording it failed, the app explicitly warns not to resend. In all these cases check the mailbox's Gmail Sent folder manually; the app has no inbox-read permission and cannot reconcile automatically. Reattempting the same review or identical saved content is blocked. This is duplicate prevention, not an exactly-once delivery guarantee.

Sent history is authoritative for provider acceptance. The editable lead/email stage remains a manual workflow label and is not automatically rewritten by sending; no concurrent workspace document is overwritten. There is no bulk send, scheduler, automatic follow-up, open tracking, inbox sync or warm-up network.

### Opt-outs and bounces

Each reviewed message includes a unique opaque unsubscribe link and List-Unsubscribe / one-click headers. GET shows a confirmation page and does not mutate data, so ordinary link previews do not suppress contacts. POST adds a permanent workspace-level suppression across both outreach mailboxes without requiring the recipient to log in. The token is hashed for lookup; unsubscribe pages do not display the recipient's address. Links must remain reachable at APP_URL.

Add reply-based opt-outs and bounces manually under **Email workspace → Do not contact**. The suppression table is separate from mutable leads, tags and workspace backup restores. There is deliberately no unsuppress control. A message whose send claim already started may still complete; suppression blocks future claims. Inbox replies and bounce detection are not automated. Do not launch unattended outreach without reviewing incoming Gmail replies/bounces.

The server secret has privileged database access; the browser never receives Gmail tokens. Email content/history is private to the signed-in Creative OS owner. The trusted server derives ownership from the verified user JWT; it never trusts an owner ID from the browser. Public unsubscribe access can only suppress the contact attached to that opaque token. Keep the outbox outside the client-editable workspace backup.

### Validation

`npm --prefix apps/outreach run test:sending` checks actual PostgreSQL migrations/claim gates, browser-role denial, limits, duplicate claims, modified drafts, persistent suppression, header-injection rejection, UTF-8 MIME encoding, server authorization, uncertain-result handling, opt-out GET/POST behavior and provider acceptance through an injected fake Gmail sender. No real email is sent by the test suite. Browser visual and live end-to-end sending checks remain required before production use.
