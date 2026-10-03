# Reference video → After Effects reconstruction

## Input

- Local job: `1791013701292-98abf962`
- Source: `Reference 1.mp4`
- Video: 6 seconds, 544 × 306, 24 sampled frames
- Storage: `.local/video-intake/jobs/` (ignored by Git)

## Validated visual plan

The sampled frames show a looping editorial animation: a yellow field, two off-canvas cream circles that meet in the center, and two centered black text states. There are no hard full-frame cut candidates.

## Created AE composition

`Reference 1 — Circle Typography Reconstruction` (composition ID 1)

- 544 × 306, 6 seconds, 30 fps
- `Background — Yellow`: full-frame yellow solid
- `Circle — Left`: cream ellipse, Position `[-92, 153, 0]` at 0 seconds → `[145, 153, 0]` at 2.5 seconds
- `Circle — Right`: cream ellipse, Position `[636, 153, 0]` at 0 seconds → `[399, 153, 0]` at 2.5 seconds
- `BE THE CHANGE.`: centered black text, visible from 0 to 2.45 seconds
- `YOU EXPECT FROM OTHERS.`: centered black text, visible from 2.45 to 4.7 seconds

## Verification

- Both circle layers have two retained Position keyframes.
- At frames 0 and 30, the title plus both circles and background are visible.
- At frames 75 and 120, the second message plus both circles and background are visible.
- At frame 150, the circles and background remain while both text states are inactive.
- The composition is left open at frame 75 for review. No AE content was undone, removed, saved, or closed.

## Current fidelity limits

This is the first controlled reconstruction pass, not a frame-perfect replica. The bridge currently supports two-key position movement per layer, which captures the incoming-circle beat but not the return-to-edge loop. It also does not yet select an exact serif/sans font family, edit text content after creation, or infer exact typography from pixels. Those are the next reconstruction capabilities.

## Version 3 — animated loop refinement

The initial reconstruction felt static because its circle layers only had an incoming two-key motion. Version 3 is retained separately as `Reference 1 — Circle Typography Reconstruction v3` (composition ID 36), so prior versions remain inspectable.

- Added a controlled `layer.addPositionKeyframes` capability: 2–8 finite, strictly increasing Position keys, all bounded by the existing allowlisted bridge.
- `Circle — Left Loop` and `Circle — Right Loop` each have five verified keys: side hold at 0–1 seconds, merge at 2.35 seconds, center hold to 4 seconds, and outward return at 5.9 seconds.
- Added opacity and per-character position reveals to both text states.
- Timeline verification at frames 0, 30, 72, 120, 150, and 177 confirms the intended title, message, merged-circle, and outward-return phases. The composition is left open at frame 72.
- The optional Bezier interpolation call remains blocked by a bridge readback limitation, so the verified loop currently uses linear interpolation. Exact font selection and full frame-by-frame typography matching remain future capabilities.
