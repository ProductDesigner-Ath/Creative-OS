# User preferences — Creative OS

- Leave changes made in After Effects visible so the user can inspect and verify them.
- Do not automatically undo, delete, or reset AE work, including during test cleanup. Undo requires an explicit user request.
- Preserve partially applied changes on failure and report what happened.
- The original G0 test intentionally undid its work. This preference supersedes that test workflow for future work.
- Do not run `ae-spike/run.mjs --verify-undo` without a fresh explicit request to test undo.
- Current next milestone: a small local bridge with structured, allowlisted AE commands. Keep results visible. No cloud or ChatGPT integration unless requested.
- Update `DEVELOPMENT-LOG.md` after every development step: changes, tests/results, limitations/blockers, visible AE state, and next step. Provide a documentation link in the response.
- The user wants development synchronized to `https://github.com/ProductDesigner-Ath/Creative-OS.git`. Preserve existing remote history. Never publish `.local/` tokens or private runtime data.

## Video-analysis workflow

- After a locally uploaded reference video finishes analysis, automatically move into the After Effects reconstruction phase. Create a new composition, build from the saved analysis evidence and controlled recipe, verify it, and retain all AE changes for user review.
- Ask only when AE is not open, an AE modal dialog blocks scripting, or another indispensable local user action is required.
