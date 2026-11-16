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

## 6. Draft preparation and optional first-contact scheduler — 16 November 2026

This section supersedes the earlier scheduler/inbox-read limitations only for this release's **explicitly approved initial emails**. Follow-up sequences, yes/no classification, a unified inbox, live web research and lead scraping remain absent. Automated warm-up conversations are not implemented; passing authentication or a small daily allowance cannot guarantee inbox placement.

### Prepare before activating

Draft generation can now deploy independently of scheduler storage: `/api/queue/drafting-status` requires sign-in but no queue tables. Missing scheduler tables disable scheduling controls without disabling configured generation. Existing workspace storage and its server read grant remain prerequisites.

1. For scheduled sending, apply `supabase/migrations/202611160001_outreach_queue.sql` to the **existing** Supabase project, after the three earlier migrations. It adds private queue/settings/heartbeat tables, an optional read-permission marker in pending OAuth state, explicit server read access to the workspace and service-only scheduling/claim RPCs. No cron job is registered by the migration. Keep the Gmail encryption key and existing tokens unchanged.
2. Deploy this branch. Existing manual sending remains separate under **Email workspace → Send one email**. Queue controls default to paused with 10 attempts per mailbox per rolling 24 hours (editable 1–15). Before a mailbox has queue settings, existing manual limits remain 20. Once set, the configured daily allowance also bounds manual claims. Scheduled spacing is 30 minutes; normal manual spacing remains 60 seconds. These are product limits, not Google quotas or inbox guarantees.
3. Optional AI drafting: add **Production-only** `OPENAI_API_KEY` and `OUTREACH_DRAFT_MODEL` for a Responses API model supporting structured JSON outputs. Use your own configured model ID; do not put the secret in chat, Git or a `VITE_` variable. API usage is separate from the website and may incur provider usage charges. Generation explicitly shares selected lead research with OpenAI when the user clicks Generate & save drafts; no email address or phone field is sent. It uses `store:false`, no tools or browsing, and untrusted-source instructions. It cannot verify LinkedIn or website claims. Outputs and warnings require human review.
4. In Google Cloud, add `https://www.googleapis.com/auth/gmail.readonly` to the existing Internal OAuth app's Data access configuration. In **Mailboxes**, use **Enable reply checks**, inspect the read-access explanation, and complete Google's consent for each outreach mailbox. Ordinary Connect Gmail stays send-only; a declined read grant does not replace the existing stored connection. No Google password is requested or stored. Read-only is a restricted Gmail scope; reassess verification/security requirements if this Internal app is ever made public.
5. Set a new random **QUEUE_WORKER_SECRET** of at least 32 characters in Production. Keep `AUTOMATED_SENDING_ENABLED` unset while preparing and testing. Do not reuse the Gmail encryption key. Existing `REVIEWED_SENDING_ENABLED` and the real `OUTREACH_POSTAL_ADDRESS` are still required.
6. Configure Supabase Cron/pg_net using `supabase/setup/outreach_scheduler.sql`: enable extensions and create the app URL and matching worker secret in Supabase Vault first. The job sends an authenticated POST to `/api/queue/tick` every minute; at most one approved email can be attempted per tick. It does not rely on Vercel Hobby's daily-only legacy cron. Review service usage limits rather than assuming all execution is unconditionally free. Never put the literal secret in the committed SQL. An authenticated tick records a heartbeat even while dispatch is disabled.
7. Verify a recent worker heartbeat in the UI. Apply actual authentication tests for each sending mailbox and check inbox/spam at a willing recipient. No live test recipient is preselected and no real sends are part of automated checks.
8. Only after a concrete test is reviewed, set `AUTOMATED_SENDING_ENABLED=true` in Production and redeploy. Each mailbox still needs its separate **Enable scheduling** action. Enabling requires read access and a worker check within five minutes. Leave both flags and provider secrets unset in previews.

### Draft, review and schedule

- Select up to ten leads without existing drafts and choose Generate & save drafts. Drafts are stored in the Creative OS lead record, **not Gmail Drafts** (the app does not request gmail.compose). Source changes while generation runs block stale saves; completed partial batch results are preserved on a later generation failure. Existing draft text is not overwritten.
- Open each draft, verify research freshness and recipient identity, edit the message and save Email stage **Approved to send**. Generated drafts start at **Draft** and are never automatically approved.
- Select an outreach sender and Review & schedule. The immutable preview includes exact recipient, subject, complete message, real postal address and opt-out link. Confirm the research/content and choose a time. Approval is for that exact message and time, not all future campaigns.
- Scheduling uses the browser's displayed IANA timezone and a local datetime input. The backend suggests the next available slot; the suggestion does not reserve or approve it. Slots must be Monday–Friday 09:00–17:00, two minutes to 30 days ahead, at least 30 minutes apart. Recipient timezones are not inferred from city names. Choose a suitable business window with the recipient's local time in mind.
- Pending emails can be cancelled; mailboxes can be paused. An already claimed send can still finish. The backend retains all items; the UI shows the latest 100. A missed slot older than 15 minutes is held for rescheduling, never sent in a burst. If an approved recipient, subject, source message, eligible stage, suppression or connection changes, dispatch fails closed. A changed postal footer also blocks the stored snapshot.

### Reply/bounce checks and delivery limits

Immediately before claiming an initial email, the worker queries Gmail for messages from that recipient since approval. Any response, including an out-of-office response, stops that queued item for manual review. It also checks recent delivery reports matching the recipient; an exact permanent-failure DSN suppresses the address, a temporary delay blocks the item, and incomplete/failed/ambiguous inbox checks pause the mailbox. These are conservative pre-dispatch checks, not continuous monitoring of every sent thread or a full opt-out language classifier. Read message bodies are processed in memory and not stored by this feature. Continue checking Gmail for later replies, opt-outs and bounces and use Do not contact as needed.

The SQL claim atomically rechecks current approval, due time, fresh inbox-check stamp, enabled mailbox, read/send scopes, owner, restrictions, whole-mailbox rolling allowance and spacing. It reuses the existing immutable outbox and single-claim send gate. Manual routes cannot send a queued snapshot early. Concurrent scheduler ticks cannot replay a claimed item. A recipient with a previous tracked attempt or active queue cannot receive another automatically scheduled initial email. Imported contact history is research context; review it before scheduling.

After claiming, Gmail gets one network submission with no automatic retries. Timeouts, uncertain acceptance or process crashes remain Unknown/Processing for manual Gmail Sent inspection. Provider acceptance means neither delivery nor inbox placement. A read/check and subsequent send have an unavoidable in-flight race; a reply/opt-out arriving after claim may not stop that already-started email.

### Validation and rollback

Run `npm --prefix apps/outreach run test:queue`, `test:gmail`, `test:sending`, `test:cloud`, root `npm test`, and the production build. Queue tests use real migrations in embedded PostgreSQL and fake Gmail/OpenAI transports—no API expenditure or real sends. Browser layout/keyboard checks and a separately approved live test remain required. Pause both mailboxes or unset `AUTOMATED_SENDING_ENABLED` and redeploy to stop future claims; optionally unschedule the named Cron job. Do not clear/retry processing or unknown items without checking Gmail Sent.
