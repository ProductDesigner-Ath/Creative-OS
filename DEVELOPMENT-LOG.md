# Creative OS — development log

This file is updated after each development step with changes, verification, limitations, and visible AE state.

## 2026-09-17 — G0 local-control spike

- Created the `creative-os` Git repository and `ae-spike`.
- Detected and tested AE 2026 **26.3x87**, English, on Windows using local ExtendScript dispatch.
- Proved active comp, text creation, Position read, Position write, and native undo.
- Three live cycles passed after correcting the two-dimensional Position assumption. AE returns `[960,540,0]` for the tested 2D layer.
- Ten evidence-validator tests passed. Logs and results are retained under `ae-spike/evidence/`; details in `ae-spike/RESULTS.md`.
- G0 left an empty, unsaved `Comp 1` open because its original test included undo.

## 2026-09-17 — review preference and local bridge

### User preferences

- Leave AE changes visible for inspection; no automatic undo or destructive cleanup. Recorded in `AGENTS.md`.
- The historical G0 runner now refuses to run without explicit `--verify-undo` opt-in.
- Maintain this documentation after each step and synchronize development to the user's GitHub repository once its URL is supplied.

### Implemented

- Strict protocol 0.1 and four allowlisted operations: inspect active comp, create text, get Position, set Position.
- Authenticated loopback HTTP service, matching local client, fixed ExtendScript adapter, stable layer IDs, active-context checks, response journals, replay protection, durable unresolved-outcome lock, and no automatic undo.
- Retained review demo that refuses duplicate runs.
- Separate `packages/protocol`, `services/local-bridge`, `adapters/after-effects`, `examples`, and `tests` areas. No empty scaffolding for future products.

### Verification

- 19 automated tests pass: original 10 validator tests plus protocol and HTTP boundary tests.
- An initial HTTP test used fetch with an overridden Host header; Node did not preserve that test header. Replaced the test client with native HTTP so it genuinely tests Host rejection. All checks now pass.
- Live bridge demo passed all four operations, including a final readback: `Creative OS`, composition ID 1, layer ID 17, moved from `[960,540,0]` to `[1080,600,0]`. No undo was issued.
- Six additional live checks passed: cached create replay did not duplicate the layer, conflicting request ID was rejected, stale context was rejected, missing layer was rejected, one created layer remained, and read-only checks preserved its current Position.
- During review, AE's Position changed to approximately `[941.96891784668,493.678756713867,0]`. The initial follow-up assertion expected the original demo Position and detected this change. No reset was performed. The check now compares state immediately before and after read-only verification, allowing the user to review and edit the retained result.
- The original text layer remains editable in `Comp 1`. AE project remains unsaved. The local bridge is running on 127.0.0.1:47831; no automatic startup was installed.
- Automated tests do not dispatch mutations. The live demo is guarded against rerun. Runtime evidence stays in `.local/`; the sanitized live summary is `docs/local-bridge-verification.json`.

### Limits and next step

- Local protocol foundation verified on this machine. This does not claim the roadmap's later AI-animation Gate 1 is passed.
- Only static Position and short text are supported. Crash recovery, multiple AE instances, and complex project coverage remain unproven.
- Next development step should be chosen after user review; keyframe support and broader state inspection are not implemented here.

### GitHub

- User supplied `https://github.com/ProductDesigner-Ath/Creative-OS.git`; configured as `origin` and fetched its existing `main` history.
- Existing remote content is a one-line README in initial commit `ff3e03a`. Intended implementation branch is `codex/local-ae-bridge`, preserving that history.
- The first Git preparation permission was declined; that command was not executed. The user subsequently instructed “Start uploading,” renewing authorization. Upload is proceeding on `codex/local-ae-bridge`, preserving the initial commit and excluding `.local/` and generated spike runs.
- GitHub CLI is not available in the current command path. Git is used directly. A per-command, exact-workspace trust setting handles the sandbox/desktop Windows account ownership difference; no global trust wildcard was added.
- `.local/` includes secrets and runtime data and is ignored. Source, tests, setup docs, and this log are intended for GitHub.

## 2026-09-17 — upload attempt

- Created `codex/local-ae-bridge` on top of the existing remote initial commit.
- Committed 33 source, test, evidence, and documentation files as `eef0c13` (`Build local After Effects bridge with retained edits and G0 evidence`). Staged whitespace checks passed. `.local/` and generated spike runs were excluded.
- Push did not succeed: Git reported `User cancelled dialog`, then could not read a GitHub username. GitHub authentication must be completed by the user before retrying. No remote upload is confirmed.
- AE was not modified during upload.

## 2026-09-17 — user manual connection check

- User ran `npm.cmd run inspect` from the repository and received a successful protocol 0.1 response.
- Active composition: `Comp 1`, ID 1, 1920 × 1080.
- After Effects host: `26.3x87`.
- Layer count: 1, confirming the retained `Creative OS` layer is visible to the bridge.
- This was read-only; no AE changes or undo occurred.

## 2026-09-17 — Position keyframe step

- Added allowlisted `layer.addPositionKeyframes` and `layer.getKeyframes` operations.
- Live retained demo verified layer 19 Position keyframes: 0s `[960,690,0]`, 1s `[960,540,0]`.
- Automated suite: 19 tests passed. The first live readback exposed AE's required second `valueAtTime` parameter; corrected to `valueAtTime(time,false)`.
- The failed attempt retained its created layer under the user's no-undo preference. No deletion or undo was performed.
- Next target: opacity keyframe writes and a guarded retained demo.

## 2026-09-17 — Opacity keyframe step

- Added allowlisted `layer.addOpacityKeyframes` with validation for two increasing times and opacity values from 0 to 100.
- Live operation succeeded on existing animation-review layer 19: opacity 0 at 0s and 100 at 1s. Result remains visible; no undo or deletion occurred.
- First attempt failed before mutation because ExtendScript lacks `Array.some`; replaced it with an ES3-compatible loop and reran successfully.
- Documentation updated in `services/local-bridge/README.md`. Next step is a combined retained position + opacity verification report.

## 2026-09-17 — simple animation preparation

- Added `assets/input`, `assets/reference`, and `assets/output` folders with placeholders.
- Personal input/reference/output files are ignored by Git by default; only placeholders are committed.
- Today’s final output will use the existing native AE text layer and keyframes, so no asset upload is required. User can add resources under `assets/input` when needed.

## 2026-09-17 — supplied animation assets

- User supplied `After-effect-assets/AF-1 Creative OS test animation assets/FOUNDATION_L00`.
- Inventory: prepared AE project `03_AE/MF_L00_First_Time_In_After_Effects_a01.aep`, AE icon PNG, paper texture JPG, Ocean_Drone MP4, eight hand-still PNGs, Illustrator design source, and rendered reference MP4.
- The supplied YouTube URL was recorded as a visual reference, but its watch page could not be fetched in this environment, so no unverified shot-by-shot claims were made.
- Current unsaved `Comp 1` was not replaced. User was asked to open the supplied AEP before asset-based animation work begins; no asset import or AE project switch occurred in this step.

## 2026-09-17 — asset-project simple animation

- User opened `MF_L00_First_Time_In_After_Effects_a01 (converted).aep` from the supplied package.
- Active composition detected: `Welcome To After Effects`, composition ID 242, 1920 × 1080, 3 existing layers, AE 26.3x87.
- Added a visible native text layer `Creative OS`, layer ID 257.
- Added and read back Position keyframes: 0s `[960,690,0]`, 1s `[960,540,0]`.
- Added and read back Opacity keyframes: 0s `0`, 1s `100`.
- No undo, deletion, reset, save, or project close was performed. The supplied project remains open and marked modified in AE for review.
- A non-blocking AE Comp Profiler notice was visible during inspection; it did not prevent bridge execution. The UI screenshot refresh used a stale desktop focus, so visual frame capture is not treated as evidence; command readbacks are the evidence for this step.

## 2026-09-17 — frame-accurate reconstruction request

- User clarified the goal: recreate the supplied After Effects animation itself, frame to frame, through the local editing system; do not add an unrelated demo.
- Ground-truth assets identified: editable `MF_L00_First_Time_In_After_Effects_a01.aep`, nested shot compositions (`SH01 Welcome`, `SH02_To`, `SH03 After Effects`, `Bar Colour`, `Texture Loop 1`), and rendered `04_RENDERS/Welcome To After Effects.mp4`.
- The current bridge can read and write a small allowlist of text, Position, Opacity, and keyframe operations. It does not yet expose layer topology, transforms beyond Position, timing metadata, footage import, masks, shape paths, effects, expressions, text styling, render comparison, or an MCP server.
- Required next architecture: read-only AE inventory and frame sampling; deterministic reconstruction commands; asset-relative imports; layer/property identity; keyframe and interpolation support; render/frame comparison; an MCP adapter only after local commands are reliable.
- User decision pending: reconstruct the full `Welcome To After Effects` composition or one shot, and whether to duplicate the source composition as the reconstruction target. Recommendation is full composition in a duplicate, preserving the original reference.

## 2026-09-17 — local MCP bridge focus

- User asked to record the MCP work as a documentation test and pause broader frame-accurate reconstruction.
- Added a local stdio MCP server boundary with seven allowlisted tools mapped to the existing local AE bridge. It does not listen on a network port and does not expose arbitrary scripts.
- Added automated MCP tests: initialization/server identity, exact tool allowlist, and rejection of an `eval` tool. These are now included in `npm.cmd test`.
- Scope is deliberately paused at the local MCP bridge: strengthen bridge reliability and command coverage before adding prompt-driven reconstruction, render comparison, or broader editing abstractions.

## 2026-09-17 — read-only layer inventory

- Added `composition.getLayers` to the local bridge and `ae_get_layers` to the local MCP boundary.
- Inventory returns stable layer ID, current index, name, host match name, in/out timing, selected/locked/enabled flags, and 3D status.
- This step is read-only and does not modify or undo the opened asset project.

## 2026-09-17 — composition state and transform inspection

- Added `composition.getState` and `layer.getTransform` to the local bridge and MCP boundary.
- Live read-only inspection succeeded: `Welcome To After Effects`, 1920 × 1080, 24 fps, 5 seconds, current time 3.4583s, work area 0–5s.
- Transform readback succeeded for layer 257: Anchor Point `[0,0,0]`, Position `[960,540,0]`, Scale `[100,100,100]`, Rotation `0`, Opacity `100`, 2D.
- No AE changes, undo, deletion, reset, save, or project close occurred.
- This capability remains focused on the local MCP bridge; frame-accurate reconstruction is paused.

## 2026-09-17 — source and text metadata inspection

- Added `layer.getSourceInfo` and `layer.getTextDocument` to the local bridge and MCP boundary.
- Live read-only inspection identified layers 254–256 as nested compositions (`SH01 Welcome`, `SH02_To`, `SH03 After Effects`) with source IDs 15, 34, and 114.
- Text readback for layer 257 succeeded: `Creative OS`, Times New Roman, 36px, fill enabled, stroke disabled, Position unchanged.
- The first text readback exposed an AE edge case for no-stroke text; the adapter now returns `strokeColor: null` and `strokeWidth: 0` when stroke is disabled.
- No AE changes, undo, deletion, reset, save, or project close occurred. All 21 tests pass after updating the MCP allowlist expectation.

## 2026-09-17 — complete animation inventory

- Added `layer.getAnimationState` and `ae_get_animation_state` for read-only transform and keyframe inspection.
- Live readback of the open `Welcome To After Effects` comp succeeded across all four layers. Layer 257 (`Creative OS`) has Position keys at 0s `[960,690,0]` and 1s `[960,540,0]`, plus Opacity keys 0s `0` and 1s `100`; the three nested shot layers have no top-level transform keys.
- No AE mutation, undo, deletion, reset, save, or project close occurred. The visible Creative OS layer remains available for user verification.
- The first batch of read-only inventory capabilities is now complete enough to guide the next local bridge batch. Full automated checks pass locally.

### Successful retry

- User requested a retry and completed GitHub authentication.
- Push succeeded: implementation commit `eef0c13` is uploaded to `origin/codex/local-ae-bridge`, with upstream tracking configured.
- Repository branch: https://github.com/ProductDesigner-Ath/Creative-OS/tree/codex/local-ae-bridge
- Existing `main` history is preserved; this work has not been merged into `main`.
- This documentation update records the failed attempt and successful retry. Local credentials, tokens, and runtime files remain excluded.

## 2026-09-17 — transform keyframe construction

- Added allowlisted Scale and Rotation two-keyframe creation through the local bridge and MCP boundary.
- Validation enforces increasing times, correct dimensions, and no expression-driven properties.
- Changes are retained and visible in After Effects; no undo or cleanup is performed.


## 2026-09-17 — anchor point keyframe construction

- Added allowlisted Anchor Point two-keyframe creation through the local bridge and MCP boundary.
- Matching dimensions and increasing times are enforced; changes remain visible in AE.

## 2026-09-17 — batch recipe contract

- Documented the deterministic call order for future prompt-driven animation recipes: discover, inspect, edit, then verify.
- The contract keeps edits structured and allowlisted while preserving visible AE changes for review.
- Higher-risk capabilities such as layer timing, masks, shapes, footage import, rendering, and rollback remain separate future batches.


## 2026-09-17 — layer timing construction

- Added allowlisted layer inPoint/outPoint editing with composition-bound validation.
- Changes remain visible in AE and are returned with before/after timing for verification.


## 2026-09-17 — live transform animation verification

- Restarted the local bridge to load the construction adapter.
- Applied and retained Scale keys on layer 257: 0s [85,85,100], 1s [100,100,100].
- Applied and retained Rotation keys: 0s -8, 1s  .
- Both operations returned successful readback; no undo or cleanup performed.

