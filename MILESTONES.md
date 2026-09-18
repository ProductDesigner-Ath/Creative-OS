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

## M2 — Reference animation building blocks (complete)

- Controlled shape and solid layers.
- Text styling and alignment.
- Text styling and alignment (font size, fill color, left/center/right paragraph alignment) are implemented; live AE verification is pending the current adapter process.
- Frame-accurate timing recipes.
- Frame-accurate review control is implemented; recipes can now target an exact composition frame.
- Render-safe verification and documented visual checks.
- Frame-specific visible-layer inventory is implemented as the first render-safe visual-check building block.
- Automatic AE host connection is verified in AE 26.3x87; one host start is needed after each AE launch.
- Layer parenting is implemented and verified live, with readable hierarchy inspection.
- Exact-frame composition markers are implemented and verified live for visible animation timing notes.
- Controlled layer stacking is implemented and verified live for foreground/background scene order.
- Approved local image, video, and Illustrator asset import is implemented and verified live; placing imported footage in a composition is the next batch.
- Imported footage placement and deterministic composition activation are implemented and verified live.
- Alpha and Luma track-matte compositing is implemented and verified live.
- Animated rectangular-mask reveals, mask feathering, and a basic per-character text-opacity reveal are implemented and verified live.
- Controlled Normal, Multiply, Screen, and Add blend modes are implemented and verified live.
- Controlled temporal easing and explicit footage/video sequencing are implemented and verified live.
- Per-character tracking and Position stagger, including fixed range-selector timing, are implemented and verified live.
- Animated two-dimensional mask feather is implemented and verified live.
- The controlled effect set starts with bounded Gaussian Blur and is verified live.
- The supplied paper scan and all eight hand stills are imported, placed, and explicitly sequenced in the retained capability composition.
- The constrained local scene recipe runner is implemented, dry-run tested, and verified live from import through final layer verification.

### M2 result

M2 passes as a local, safe capability layer for the upcoming reference-video test. It deliberately does not claim the reference video has been recreated. The next approved milestone should create that video in a dedicated composition using the supported recipe primitives and supplied resources.

## M3 — Reference-video test (in progress)

- Dedicated retained test composition: `Creative OS Reference Test 01` (ID 104).
- Initial asset, timing, title-animation, compositing, and frame-inventory pass is complete.
- Remaining work: visual comparison against accessible reference frames and iterative art-direction tuning. M3 does not pass until that comparison is complete.

Every milestone records its implementation, tests, results, limitations, and blockers in `DEVELOPMENT-LOG.md`.

### M3 progress — converted-project reference pass

- Source composition inventory and top-level timeline data have been read successfully.
- `Creative OS Recreation` (257) reproduces the final comp’s three-scene timing using separate retained layers at the exact source positions and durations.
- Next: independently reconstruct each scene’s internal artwork, masks, and controlled effects rather than using the source precompositions.
