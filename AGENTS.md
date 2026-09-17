# User preferences — Creative OS

- Leave changes made in After Effects visible so the user can inspect and verify them.
- Do not automatically undo, delete, or reset AE work, including during test cleanup. Undo requires an explicit user request.
- Preserve partially applied changes on failure and report what happened.
- The original G0 test intentionally undid its work. This preference supersedes that test workflow for future work.
- Do not run `ae-spike/run.mjs --verify-undo` without a fresh explicit request to test undo.
- Current next milestone: a small local bridge with structured, allowlisted AE commands. Keep results visible. No cloud or ChatGPT integration unless requested.
- Update `DEVELOPMENT-LOG.md` after every development step: changes, tests/results, limitations/blockers, visible AE state, and next step. Provide a documentation link in the response.
- The user wants development synchronized to `https://github.com/ProductDesigner-Ath/Creative-OS.git`. Preserve existing remote history. Never publish `.local/` tokens or private runtime data.
