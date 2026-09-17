# G0 results — September 17, 2026

**Gate G0: PASS, bounded to the tested local environment.**

## Environment

- Windows; installed executable `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe`.
- Executable product version 26.3; live scripting host reported **26.3x87, build 87, en_US**.
- Node.js 24.14.0; Git repository initialized in `creative-os`.
- AE was opened by the user. The initial project was empty and untitled. A 1920 × 1080, 29.97 fps, 30-second `Comp 1` was created through AE's UI as the test fixture, outside the five-operation spike.
- File logging permission was already effective. No preference changes or extension installation were needed.

## Observations

| Operation | Verified live result |
| --- | --- |
| Get active composition | `Comp 1`, ID 1, 1920 × 1080, initially zero layers |
| Create text layer | Source Text readback exactly `Creative OS`; layer count increases by one |
| Read Position | `[960, 540, 0]`; `threeDLayer` is false |
| Set Position | Requested and actual values both `[1080, 600, 0]` |
| Undo | Native Undo restores original ordered layer IDs `[]`; created text layer no longer exists in the comp |

## Retained runs

Paths below are under `evidence/`. Each directory contains the original JSONL events, manifest, and result.

| UTC start / run ID | Outcome |
| --- | --- |
| `2026-09-17T15-42-31-405Z-a0b9788c` | Initial failure: test incorrectly required a two-value Position. Text creation succeeded; error cleanup reported `undo_verified`. |
| `2026-09-17T15-43-21-328Z-0eee139c` | PASS after accepting AE's three-value Position and preserving Z. Created layer ID 14, then undone. |
| `2026-09-17T15-45-00-340Z-ea51b001` | PASS on final source after adding explicit mutation status to failure logging. |
| `2026-09-17T15-45-01-218Z-bfb8a418` | PASS again on final source. |

Three successive live cycles passed after correcting the Position assumption. Two used the final source. Source hashes in manifests identify the tested revisions. All successful runs restore the empty layer list. The test fixture composition remains open and unsaved; the script never saves the project.

Ten validator tests passed: complete evidence accepted; stale identity, omitted event, duplicate event, wrong layer, unapplied movement, lost pre-existing layer, changed layer order, residual text layer, and host failure all rejected. These are harness checks, not substitutes for the live runs above.

## Blockers and remaining limits

No blocker remains for G0 on this machine. The initial launch attempt in the prior turn was stopped by the user; work resumed after the user opened AE. A UI rename attempt had a stale accessibility element, so the default fixture name `Comp 1` was retained.

Native Undo command 16 is verified on this English 26.3x87 installation only. The live runs used an empty composition, not an existing production project. Permission-disabled, timeout, multiple-instance, and complex-project behavior have not been exercised live. See `README.md` for recovery and scope limitations.

No work beyond Milestone 0 was implemented.
