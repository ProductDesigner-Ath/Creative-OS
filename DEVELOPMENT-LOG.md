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

### Successful retry

- User requested a retry and completed GitHub authentication.
- Push succeeded: implementation commit `eef0c13` is uploaded to `origin/codex/local-ae-bridge`, with upstream tracking configured.
- Repository branch: https://github.com/ProductDesigner-Ath/Creative-OS/tree/codex/local-ae-bridge
- Existing `main` history is preserved; this work has not been merged into `main`.
- This documentation update records the failed attempt and successful retry. Local credentials, tokens, and runtime files remain excluded.
