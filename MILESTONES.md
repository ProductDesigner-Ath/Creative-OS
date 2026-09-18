# Creative OS milestones

GitHub contains implementation code and milestone documentation only. Adobe After Effects projects, source assets, renders, local logs, credentials, and runtime state stay on the local machine.

## M0 — Local AE control (complete)

- Establish a localhost-only, authenticated bridge to the installed After Effects instance.
- Implement the five initial G0 operations and retain visible AE changes for review.
- Result: passed for AE 26.3x87.

## M1 — Structured animation construction (in progress)

- Composition and layer inspection.
- Text creation and metadata readback.
- Position, Opacity, Scale, Rotation, Anchor Point keyframes.
- Layer timing and Bezier interpolation controls.
- Result: automated contract tests pass; live construction is verified where the running bridge has loaded the current adapter.

## M2 — Reference animation building blocks (in progress)

- Controlled shape and solid layers.
- Text styling and alignment.
- Text styling and alignment (font size, fill color, left/center/right paragraph alignment) are implemented; live AE verification is pending the current adapter process.
- Frame-accurate timing recipes.
- Frame-accurate review control is implemented; recipes can now target an exact composition frame.
- Render-safe verification and documented visual checks.
- Frame-specific visible-layer inventory is implemented as the first render-safe visual-check building block.
- Automatic AE host connection is verified in AE 26.3x87; one host start is needed after each AE launch.
- Layer parenting is implemented and verified live, with readable hierarchy inspection.

Every milestone records its implementation, tests, results, limitations, and blockers in `DEVELOPMENT-LOG.md`.
