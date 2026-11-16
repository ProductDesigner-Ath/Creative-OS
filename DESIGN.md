# Creative OS — Design system

Status: v0.1, implementation baseline for Email & Leads. Updated 14 November 2026.

Read this file before adding or changing a user-facing screen. This is the shared design direction for the local prototype and the Windows desktop installation. Prefer existing patterns; change these rules deliberately when product evidence calls for it. Do not create a parallel set of tokens or components in a new feature.

## 1. Product purpose and scope

Creative OS is Satavue’s workspace for managing work. The current product surface is **email and leads**: research a company, identify a contact, draft a relevant message, review it, and maintain a clear next action through conversion.

Current navigation: Overview, Lead desk (Table / Board), Email workspace, Mailboxes, Processes & systems, Tags. Data and appearance settings live in Settings. Do not add creative production, billing, finance, calendars or speculative features to the current navigation.

The existing After Effects bridge remains a separate capability. This interface must not start, alter or weaken that bridge to display a screen.

## 2. Reference and interpretation

Primary reference: [DesignerHQ](https://designerhq.app/), reviewed through its public website and animated product previews on 14 November 2026. The signed-in application has not been audited.

Observed in the public preview: dark neutral work surfaces, persistent navigation, compact task/board layouts, explicit owners and stages, and work organised around processes rather than decorative metrics.

Additional references: the user-supplied light workspace, monochrome dark dashboards and restrained writing-panel examples in this conversation.

**Creative OS decisions below are our specification, not measurements or extracted tokens from DesignerHQ.** Do not copy its branding, content, client records, proprietary artwork or trade dress.

Use the references for hierarchy, density and restraint. Keep Creative OS recognisable through quiet orange accents, consistent typography and domain-specific workflows.

## 3. Visual principles

1. Work first. Tables, conversations, evidence and next actions occupy the main canvas.
2. Neutral foundations. Use colour for meaning, focus and ownership, not for filling space.
3. Quiet hierarchy. Surface contrast, typography and spacing establish importance before borders and shadows.
4. Predictable controls. The same action uses the same label, component, location and confirmation behaviour.
5. Honest state. A saved draft is not sent; an authenticated domain is not a connected mailbox; a plan is not running automation.
6. Data earns its place. Every metric must inform a decision and have an identifiable source and timeframe.
7. Keep context. Reviewing a lead opens a side panel and preserves the table’s filters, position and selection.

### Avoid

- Gradient hero sections, decorative glows, glass panels, oversized greetings or marketing slogans inside the app.
- Repeated four-card KPI rows on every screen. A count strip belongs only in Overview when it helps triage; Lead desk opens directly into working views.
- Sparkles, AI badges, fake assistant avatars and generic “AI-powered” language.
- Arbitrary percentage growth, fabricated revenue graphs, invented warm-up/health scores or decorative charts.
- An icon beside every label, rainbow tags, excessive pill shapes or nested cards around ordinary text.
- Placeholder buttons that appear to perform real operations. Use a labelled preview state or explain the connection step.
- Text below 11px as a way of fitting more data. Prefer column choice, scrolling or a detail panel.

## 4. Component foundation

Use **React + shadcn/ui + Tailwind CSS**, with Lucide icons. shadcn components are committed source code under `apps/outreach/src/components/ui/`, not a hosted dependency on Vercel. The app runs locally.

| Need | Foundation | Creative OS rule |
| --- | --- | --- |
| Action | Button | One primary action per section; label with a verb |
| Text input | Input, Textarea, Label | Visible labels; help and validation tied to the field |
| Modal | Dialog | A short, bounded task such as import or tag creation |
| Record details | Sheet | Lead evidence, next action and email draft in one panel |
| Status | Badge | Text plus optional dot; colour never carries the meaning alone |
| Content grouping | Card | Only for a distinct object, grouped summary or section |
| Bulk selection | shadcn Checkbox | Show selection scope and action count |
| Data table | shadcn Table with semantic headers | Real headers, explicit selection labels, horizontal overflow |
| Small finite choice | shadcn Native Select | Keyboard-compatible and labelled; do not fake a listbox |
| Future complex menu | Dropdown Menu / Command | Add when the workflow needs it; avoid bespoke keyboard logic |
| Toast | Single live-region notification initially | No critical errors only in a disappearing toast |

Component primitives supply behaviour; design tokens supply identity. Do not copy a full shadcn dashboard template and fill it with unrelated metrics. Do not remove focus management or accessible names when restyling components.

## 5. Colour tokens

Semantic colour tokens are mandatory. Raw values belong in the central theme files, not feature components.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| App background | `#FAFAFA` | `#111213` | Main working canvas |
| Sidebar | `#F3F4F4` | `#141617` | Persistent navigation |
| Panel | `#FFFFFF` | `#191B1D` | Table container, editor, grouped content |
| Raised panel | `#FFFFFF` | `#202326` | Dialogs, popovers |
| Hover / muted surface | `#F0F1F2` | `#24272A` | Hover and secondary grouping |
| Primary text | `#222426` | `#ECEEED` | Main content and titles |
| Secondary text | `#4F555B` | `#BAC0C5` | Supporting content |
| Muted text | `#64686D` | `#A5AAAF` | Metadata, hints, descriptions |
| Divider | `#DFE1E4` | `#34383C` | Decorative section and row separators |
| Input boundary | `#858B92` | `#737B84` | Essential control boundaries where needed |
| Orange / focus | `#AD4D1C` | `#F39B67` | Selected icon, focus ring, restrained accent |
| Orange surface | `#FFF0E6` | `#32261F` | Small contextual notice |
| Positive text / surface | `#286447` / `#EBF5EF` | `#A0D2B5` / `#20362A` | Successful state |
| Attention text / surface | `#78500D` / `#FFF4DC` | `#E4C184` / `#382E1D` | Action needed |
| Error text / surface | `#A83232` / `#FCEEEE` | `#F0A5A5` / `#3A2426` | Failure or destructive state |

Primary buttons use a high-contrast neutral fill. Orange is not required on every action. Never communicate success merely with orange or green decoration.

Use WCAG 2.2 AA targets: 4.5:1 for ordinary text, 3:1 for large text and meaningful UI boundaries/focus indicators. Check actual foreground/background pairs, including hover and disabled states. Decorative dividers may be subtle; essential input boundaries cannot rely on them. No claim of a full accessibility audit until measured and keyboard/screen-reader testing is complete.

## 6. Typography

Use one system sans-serif stack initially: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Inter is only used if installed; do not silently fetch fonts from a CDN. On Windows the system fallback is Segoe UI. A bundled licensed font can be added as a separate deliberate decision.

| Role | Size / line height | Weight | Rule |
| --- | --- | --- | --- |
| Page title | 24 / 32px | 550–600 | Short object/view name: “Lead desk” |
| Section title | 16 / 24px | 550–600 | Names the content |
| Panel title | 18 / 26px | 550–600 | Lead or process name |
| Body, form values | 14 / 21px | 400 | Primary reading size |
| Navigation, table primary content, buttons | 13 / 20px | 400–500 | Compact but readable |
| Metadata, tag, table heading | 12 / 18px | 400–500 | No tiny all-caps labels |
| Exceptional secondary annotation | 11 / 16px | 400 | Never for important information or controls |
| Numeric summary | 24 / 30px | 500 | Tabular numerals; meaningful counts only |

Sentence case throughout. Prefer normal letter spacing; headings may use -0.4px. Avoid decorative uppercase eyebrows, extreme negative tracking and excessive weight changes. Truncate only with an accessible way to read the full value.

## 7. Spacing, shape and density

Spacing scale: **4, 8, 12, 16, 20, 24, 32, 40, 48px**. Use 4px only for small inline gaps. Use 8px within control groups, 16px within sections, 24px between related sections and 32px between larger groups.

| Element | Specification |
| --- | --- |
| Workspace rail + sidebar | 52px workspace rail + 216px navigation desktop; compact rails on narrow screens |
| Topbar | 56–64px; breadcrumb and relevant controls only |
| Page padding | 24px desktop, 16px narrow |
| Control height | 36px default; 32px compact; >=44px touch mode |
| Icon | 16px in compact controls; 18px in navigation; 1.5px consistent stroke |
| Radius | 6px small controls, 8px buttons/inputs, 12px panels, 16px dialogs |
| Table row | Minimum 56px; 64–72px for two-line contact rows |
| Board column | 264px minimum; horizontal board scroll within the content region |
| Lead panel | 600–680px desktop; full width on small screens |
| Modal | 480–640px; bounded height with internal scrolling |
| Shadow | None for table rows/cards; subtle only for floating content |

The application is full-window at every viewport size. No outer body padding, max-width presentation frame, rounded outer corners, landscape backdrop or inset desktop mockup. The sidebar and main canvas reach the viewport edges. Internal page padding still follows the spacing scale. This applies to the local preview as well as the desktop installation.

## 8. Information architecture

| View | User’s question | Primary action |
| --- | --- | --- |
| Overview | What needs attention? | Open the next lead/action |
| Lead desk | Who should we approach and why? | Add/import, then review a lead |
| Lead desk → Board | Where is each opportunity? | Switch views without losing lead filters or selection |
| Email workspace | What needs drafting or review? | Open the relevant lead draft |
| Mailboxes | Which identity is connected and able to send? | Inspect connection/setup |
| Processes & systems | How do we repeat this work consistently? | Create/edit a process |
| Tags | How do we group and find the work? | Create a categorised label |
| Settings | Where is data stored and how do I move it? | Export/restore a full backup |

Use the same lead record in all views. Do not duplicate lead state inside campaign, inbox and pipeline objects without a stable ID relationship.

## 9. Lead stage, email stage and tags

These are separate dimensions, not interchangeable colours on a card.

### Lead stage — one current sales state

New → Approved → Pitched → Replied → Call booked → Proposal → Won.

Lost and Skipped are alternatives. Permit corrections without erasing history. A lead can reply negatively; “Replied” is not evidence of a qualified opportunity. In production, moving to Won should require a clear outcome record rather than inferring it from email activity.

### Email stage — one current communication state

Not started, Researching, Draft, Ready for review, Approved to send, Sent, Follow-up due, Replied, Bounced, Unsubscribed.

In the layout preview, stage changes are manual labels. They must not create network activity. In a future sending system, Sent/Replied/Bounced must be supported by provider events and timestamps, and manual corrections must be distinguishable.

### Tags — many reusable classifications

| Category | Examples | Meaning |
| --- | --- | --- |
| Email | Personalisation, Follow-up 01 | Message context |
| Process | UX audit, Lead qualification | Reusable method or service |
| System | Lead Desk, Gmail integration | Tool/system association |
| Segment | SaaS, Agency partners | Audience grouping |

Tags are searchable/filterable and usable on leads and process records. Tags use a neutral outlined treatment; the tag manager groups their categories explicitly, and category is available on the tag. Do not assign random hues. Use the label before colour. Tags do not trigger automation unless an explicit rule explains the trigger and effect.

Unsubscribe and bounce suppression are future first-class contact restrictions, not removable marketing tags. Removing a tag or changing sales stage must never clear a suppression rule.

## 10. SaaS interaction patterns

### Navigation and views

- Persistent active navigation and a single page title; back/close returns to context.
- Keep table and board views over the same filters and record set.
- Lead tables paginate at 25 records per page and show the current range. Selection scope stays explicit across pages. Large boards still need virtualisation before production-scale use.
- Preserve search and filters while opening/closing a lead. Future routing should preserve view/filter state in URLs where safe.
- Icon-only navigation on narrow screens needs accessible names; tooltips can enhance, not replace, names.

### Search and filtering

- Search company, contact, email, owner, opportunity and tags.
- Separate source, market, lead stage, email stage and tag filters as needed. Do not present nonfunctional filters.
- Show zero-result state with the current context and a clear reset path.
- Bulk actions display the number and scope of selected records, including offscreen selection. “Select all” means all filtered records unless explicitly stated otherwise.
- Table sort and pagination must be real features before visual affordances advertise them.

### Forms and saving

- Visible labels, optional examples, explicit required fields, sensible defaults.
- Validate on submission and after relevant field interaction. Preserve entered text on errors.
- Use an explicit Save for multi-field lead edits. Editing a draft is not sending it.
- For production editors, track dirty state and warn before discarding unsaved changes. Never silently lose an email draft on navigation.
- Saved confirmation names the result. Critical validation/storage errors remain visible near the editor; a toast alone is insufficient.
- Disable duplicate submissions while pending. Save errors preserve the draft for retry/export.

### Import and portability

- Import is a preview-first flow: choose/paste → map/inspect → review duplicates → confirm.
- A company name is required; unknown source fields are retained for review.
- Existing records are not overwritten by a duplicate import. Report imported, skipped and failed counts.
- Distinguish company funding from an estimated project/deal value. Never treat funding as pipeline revenue.
- A full JSON backup preserves IDs, tags, drafts, process plans and history. CSV is an exchange view, not a complete workspace backup.
- State clearly that browser storage is local, not GitHub/Claude/Google sync. Export is needed to move records between computers until persistence/sync is implemented.

### Record and process panels

Lead panel sections: identity → contact/owner → sales and email stages → next action/date → evidence → tags → draft → save.

Process panel sections: name → steps/description → lifecycle status → assigned tags → notes. Planned/In progress/Ready/Paused describes the process’s implementation readiness, not an execution state.

### Destructive and consequential actions

- Prefer archive and undo for record removal. Confirm irreversible actions with the object and consequence named.
- Full-backup restore explicitly states it replaces local state; offer export first.
- Real email sending is a separate future action: sender, recipient count, content, schedule and opt-out behaviour must be reviewable before launch.
- Do not connect the main `satavue.com` mailbox for outreach. Sender allowlist: `sagorika@satavuestudio.com`, `sagorika@withsatavue.com`.
- Never label a simulated network as guaranteed “warm-up.” Authentication is identity verification, not an inbox guarantee.

## 11. Standard UI states

| State | Required treatment |
| --- | --- |
| Loading | Stable skeleton only when real asynchronous work is pending; never simulate waiting for effect |
| Empty workspace | Explain the purpose and offer add/import |
| No search results | State that filters found no matches and provide reset |
| Save pending | Button shows progress, retains context, prevents duplicates |
| Saved | Short confirmation, no modal interruption |
| Validation failure | Inline field error with accessible association; focus first error |
| Storage/service failure | Persistent explanation, preserved work, retry/export action |
| Disconnected | Explicit Not connected; setup action, no green success signal |
| Preview | Persistent, concise sample/local-only notice; fictional data clearly marked |
| Partial import | Counts, failed row details, successful records retained |
| Offline | Distinguish browser-local editing from provider/network actions |

## 12. Accessibility and responsive behaviour

- Target WCAG 2.2 AA; treat it as acceptance criteria, not a certification badge.
- Use semantic headings, tables, buttons, labels and fieldsets; a clickable div is not a button.
- Every icon-only control has an accessible name. Form errors use `aria-describedby` and `aria-invalid` in production form components.
- Full keyboard path: navigation → filters → records → detail panel → actions. Dialog/Sheet traps focus, closes with Escape and restores focus to its trigger.
- Visible focus ring in both themes. No focus indication removed for aesthetics.
- Do not expose background content as interactive while a modal is active.
- Touch targets meet 24px minimum WCAG target-size requirements or spacing exceptions; prefer 44px for touch.
- Test at 1440, 1280, 768 and 390px widths, 200% zoom and reduced motion.
- Data tables may scroll horizontally inside their container; the full page must not overflow.
- Panels become full-width on mobile. Controls wrap in a useful order; do not hide the primary action.
- No state depends on hover alone. No colour-only tag, error, selection or status.

## 13. Motion and content

Motion: 120–180ms for hover/focus; up to 220ms for modal/panel entry. Use opacity and small translations only. Respect reduced-motion settings; no bounce, pulsing success or continuously animated dashboard decoration.

Content: short, literal, action-oriented. Use “Lead desk”, “Import CSV”, “Save draft”, “Not connected”, “Next action”. Avoid “Your next client starts here”, “Unlock growth”, “Seamless”, “AI magic” and greetings that displace work. Explain consequences at the action, not in a wall of warnings.

Dates follow the user’s local timezone; scheduled sends show the timezone. Unknown values use “Not set” or “Not checked”, not zero. Sample counts must be labelled; do not imply commercial performance.

## 14. Implementation and review contract

- Canonical design direction: this file. Component config: `apps/outreach/components.json`. Theme: `apps/outreach/src/components.css`. Layout styles: `apps/outreach/style.css`.
- Separate theme colour semantics from layout-specific legacy variables. New components use the semantic shadcn tokens; do not create feature-local palettes.
- New UI screens use shared Button/Input/Badge/Dialog/Sheet primitives rather than hand-building equivalent controls.
- No credentials, private lead exports or runtime data in Git. Use synthetic examples in committed fixtures.
- Update DEVELOPMENT-LOG.md with implemented work, validation, known gaps and the next step. Report AE state explicitly when relevant.
- Design direction approval does not imply automatic approval of new external connections or mail sending.

### Definition of done for a screen

1. One clear user task and primary action.
2. Consistent navigation, spacing, typography and theme tokens.
3. States and data provenance are honest; no unsupported action appears to run.
4. Keyboard navigation, visible focus and modal behaviour checked.
5. Both themes and narrow-width layout reviewed.
6. Important text has measured contrast; table labels and values are readable.
7. Save/reload, validation, no-results and error recovery checked as applicable.
8. Shared components reused; intentional exceptions documented.
9. Private/runtime data excluded from the diff.

### Current prototype limitations to retain in release notes

The layout uses the actual shadcn registry Button, Badge, Card, Input, Textarea, Label, Dialog, Sheet, Table, Tabs, Native Select, Checkbox and Progress. Source provenance is recorded in apps/outreach/COMPONENTS.md. Local browser storage and manual stage editing only. No Gmail OAuth, sends, automated warm-up, reply detection, suppression worker, background scheduler or live Claude synchronisation. The CSV path is an integration boundary, not a claim that all existing Lead Desk records have already migrated. The table paginates at 25 records per page. Production-scale board virtualisation, comprehensive import mapping, audited contrast and full accessibility evaluation remain follow-up work until explicitly verified.


### Hosted prototype persistence addition — 2026-11-14

The hosted prototype adds an email/password sign-in form using the shared Card, Label, Input and Button primitives. Credentials are submitted only to the configured Supabase project. No public registration form is included. The cloud workspace starts empty and is private per login; a shared team workspace is not implemented. Saves show a blocking progress state and preserve unsaved documents behind a retry/export screen on failure. Revision conflicts never automatically overwrite newer records. Cloud records load on sign-in/reload rather than live subscriptions. Local preview retains browser storage only when no cloud environment is configured on loopback. Hosted builds with missing configuration fail closed. Existing Gmail and sending limitations continue to apply.

### Reviewed sending addition — 2026-11-15

Email workspace uses the existing shadcn Card, Native Select, Dialog, Checkbox, Input and Table primitives. A saved draft is selected, reviewed as an immutable server snapshot, and sent only after a separate explicit Send 1 email action. The review includes sender, recipient, subject, complete plain-text message and appended sender-address/opt-out footer. Backend sending is disabled until explicitly activated in Production. Sender selection never includes the main domain. No decorative metrics or new navigation item is introduced.

Send history distinguishes Reviewed, In progress, Accepted by Gmail and Uncertain. Provider acceptance is not delivery. Uncertain attempts have a persistent check-Gmail instruction and no automatic retry. A separate Do not contact section owns persistent opt-out/bounce restrictions; lead stages and tags cannot clear them. Lead/email stages remain manual labels and are not presented as provider events. A reviewed send does not overwrite the whole workspace document. Latest 100 history/restriction rows are displayed with that scope stated. Inbox/bounce sync, scheduled sending, warm-up and full accessibility/visual audit remain unimplemented.

## Lead views and semantic feedback — 15 November 2026

Lead desk is the single navigation destination for lead records. Use the labelled Table / Board toggle in its toolbar. Keep filters, selected records and table pagination when switching; remember view preference locally. Pipeline is a board view, not a separate menu item.

Use the shared shadcn-style Alert primitive through Feedback for errors, warnings, successes and information. Red means failure, amber means caution/action needed or an uncertain send, green means completed success, and blue means information. Use the existing positive/attention/negative tokens and central information tokens (#235B9B on #EDF4FF light; #A8C9F5 on #1C2B40 dark). Pair color with a distinct icon, understandable message and screen-reader severity label. Errors use role=alert; noncritical updates use role=status. Critical failures persist with a recovery action, never just a timed toast. Gmail acceptance is success of submission, not proof of delivery.

## Independent lead imports — 15 November 2026

Creative OS is the independent lead workspace. Do not show external Lead Desk navigation or require the source artifact after importing. CSV preview must display input row/column counts, additions, matched rows and missing emails. Never imply matched rows were merged: existing records are protected and skipped matches must be called out. Retain every original source cell on the record and in JSON backups; include originalFields JSON in CSV exports. Expose role, location, phone, verification, evidence/listing, value, last contact, historical sender, needs, offer, fit and rejection reason in lead details. Historic sender is evidence only and must never override the outreach sender allowlist. Missing emails remain blank and imported sales labels do not prove provider events.

## Preparation and approved scheduling — 16 November 2026

Email workspace contains Drafts & schedule and Send one email tabs; keep one sidebar destination. The preparation panel uses real instructions and results, never a warm-up score, fake inbox placement or simulated network. Daily allowance starts at 10 per mailbox (maximum 15 for this release), includes attempted manual sends, and has a visible paused/enabled state. Show last worker check separately from server configuration; an environment flag alone does not prove a running job.

Source-bound generation produces saved Creative OS drafts, never Gmail Drafts or an automatic approval. Explain the OpenAI data destination at the Generate action. Preserve existing drafts and concurrent lead edits; show research warnings. No source scraping or invented LinkedIn access. Use the existing Sheet for edits and shadcn Dialog for approval of the exact final recipient/content/footer/time. Generated drafts start at Draft. Timezone must be explicit; no inferred recipient timezone. Paused is the default and follow-up branching stays absent until separately designed. Cancel/pause copy explains the in-flight limit. Queue results distinguish scheduled, processing, accepted, replied, blocked, missed and uncertain, with semantic colors and text. Successful Gmail acceptance is never presented as inbox placement.

Draft readiness is independent from scheduling readiness. Missing queue tables or an inactive scheduler must not prevent configured AI draft generation. Show a scheduling warning while keeping research selection and draft generation available. The provider key/model remain required; never fabricate generated messages or show success before a real response and successful workspace save.

## Preserve workspace modes on release — 16 November 2026

Studio and Projects are existing workspace modes. Email feature releases must preserve the Studio/Projects shell, project context and section navigation. Do not ship an email-only App replacement over the integrated workspace. Check all existing workspace modes in the release build. The assistant work is separate from restoring these established screens.

## Account-scoped assistant — 16 November 2026

Preserve the complete Studio/Projects/Email shell. The labelled Assistant topbar action opens the existing shadcn modal Sheet on the right, full-width on small screens. Chat, Memory and Files tabs use existing primitives and semantic feedback. No new global navigation destination or decorative dashboard metrics. Messages render plain text, never provider-generated HTML. Close/context/conversation changes preserve unsent text and unsaved notes; busy actions disable duplicates. This modal panel must be closed to navigate background work.

Scope is explicit: Studio, a saved project or a lead. Studio notes inform all contexts; other notes stay scoped. Saved chat and files belong to the Creative OS account, not the ChatGPT account. Text describes bounded recent/keyword recall, explicit pinned notes, and reattachment for later file analysis. No unlimited-memory promise. The public key stays client-side; provider/service keys stay server-side. Error/configuration states must distinguish missing schema, missing AI setup and failed response without exposing secrets.

Draft suggestions show complete proposed subject/body before Save as lead draft. This action never approves or sends. Uploaded files live in a private bucket and disclose the model data destination. Recent-upload deletion wait protects against still-valid signed upload links. Existing Reference room filename-only entries remain metadata until actual files are uploaded here. Visual and assistive-technology evaluation remains pending; a passing build is not visual QA.

## Full-window chat and provider connections — 16 November 2026

The user requested GPT/Claude-style assistance. Assistant now defaults to a full-window Sheet with a conversation rail, readable central message column, bottom composer and compact-panel option. This deliberately supersedes the earlier narrow-sheet default. Keep existing Studio/Projects/Email screens intact; no vendor consumer app/history access is implied. Provider selection is explicit and creating a conversation captures its provider/model. Starting another provider opens a new conversation; pinned Studio/project notes may be shared with that chosen provider, disclosed near the composer.

App bridges includes AI connections above local application readiness. Each provider row has capability, real connection source, exact model, verification time and explicit actions. OpenAI/GPT and Anthropic/Claude are chat; Higgsfield is media. Do not advertise media generation until a reviewed generation workflow exists. Password fields collect full copied credentials and never show saved secrets. Verification saves only after the provider accepts the key/model check; failures preserve previous credentials. Server-configured fallback stays visibly distinct from account-saved keys. Semantic feedback and existing shadcn Card/Dialog/Input/Button/Badge primitives remain mandatory.

## Global assistant launcher — 16 November 2026

Use one labelled floating Assistant button fixed to the bottom-right viewport corner across all workspace modes. Remove assistant actions from the sidebar and topbar. Desktop inset is 24px, narrow-screen inset 16px, respecting device safe areas; minimum height 48px. Use the shared Button and neutral theme tokens with a modest floating shadow. The launcher sits below modal overlays, retains the unsaved-lead guard, and receives focus when chat closes. Chat contents, provider controls and full-window/compact modes are unchanged.

Chat window controls use Lucide Maximize2/Minimize2 and X icon buttons grouped at the top-right of the chat header. No expand/compact text button or duplicate close control. Provide action-specific accessible labels, native title tooltips, visible focus and 44px touch targets. Close retains the existing unsaved-content guard.
