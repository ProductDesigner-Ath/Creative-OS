# Creative OS — Email & Leads

**Hosted prototype setup:** [DEPLOYMENT.md](DEPLOYMENT.md). Supabase login and private per-user persistence are implemented but require applying the SQL migration, creating a login and deploying the correct Git branch. Gmail remains disconnected. Local preview without cloud configuration retains the browser-local layout.

A full-window local layout for Satavue’s acquisition workflow. Built with React, Tailwind and actual shadcn/ui registry components. See [DESIGN.md](../../DESIGN.md) and [component provenance](COMPONENTS.md).

## Run on your desktop

Requires Node 22.12+ (Node 24 is recommended). From the repository root, including `D:\Creative-OS` on Windows:

```powershell
npm run outreach:install
npm run outreach:build
npm run outreach
```

Open **http://127.0.0.1:47832/** in your browser. Keep this terminal running while using the app. No After Effects process or bridge is required. There is no Vercel deployment.

For frontend development with automatic reload:

```powershell
npm run outreach:dev
```

Development runs separately on http://127.0.0.1:47833/. These are different origins: their browser storage is separate. Use export/restore to move data between them. The production preview's server is loopback-only, rejects unexpected Host headers, serves only built assets, and has no API or send endpoint.

The app and its dependencies live in this folder; the existing root AE commands are unchanged. `npm test` remains dependency-free for the AE/model/server contract tests. The frontend build requires installing this folder’s dependencies first.

## What works

- Full-screen dark/light workspace with a workspace rail, grouped navigation, compact review tabs and table/board views.
- Search, market/lead-stage/email-stage/tag filters, and a clear-filters action.
- Shared lead details in a shadcn Sheet: ownership, next action/date, evidence, independent sales/email stages, tags and local email draft.
- Protection against closing a lead editor with unsaved changes.
- shadcn Dialog workflows for adding leads, creating tags and editing process records.
- Multi-select and additive bulk tagging.
- CSV preview/import with common Lead Desk headers, quoted/multiline content and duplicate detection. Original columns retained in full backup.
- JSON export/restore for the complete workspace; CSV export for exchanging lead rows.
- Local activity history, process plans and explicit mailbox integration status.

## Data boundary

The default records are fictional and use reserved `.example` email domains. No real leads or credentials are committed.

Changes persist in localStorage **in the current browser on the current computer**. They do not sync to Claude, Google or GitHub. Export a **full JSON backup** before moving to another computer/origin, clearing browser data or switching profiles. JSON preserves tag IDs, drafts, process records and history; CSV is not a full-fidelity backup.

## Bring in the original Lead Desk

1. Open the original dashboard using the sidebar link.
2. Export its CSV.
3. Choose Import CSV here; select the file or paste its contents.
4. Review the first records and the new/duplicate count. Optionally remove the illustrative samples.
5. Confirm the import. A duplicate company + email does not overwrite existing work.

This is a CSV integration path, **not live synchronisation or an embedded Claude artifact**. The import currently maps common headers; review the preview and original fields for exports with different column names. Funding figures are never assumed to be project values.

## Not connected

No Gmail OAuth, email sending, artificial warm-up, automatic reply reading, mailbox health checker, scheduler, live discovery or suppression worker. Stage changes are manual labels only. The sender choices contain only the two outreach identities; `satavue.com` is excluded.

Do not load production credentials or treat manually labelled Sent/Approved stages as proof of actual sends. Real sending needs a separate implementation with provider events, opt-out enforcement, review and permission handling.

## Verification

```powershell
npm test
npm run outreach:build
```

The tests cover CSV parsing/mapping and malformed data, deduplication, draft round-tripping, synthetic fixtures, sender allowlist and HTTP boundaries, in addition to existing AE contracts. They do not exercise a live Windows AE session or certify email deliverability. Browser checks are recorded in DEVELOPMENT-LOG.md.
