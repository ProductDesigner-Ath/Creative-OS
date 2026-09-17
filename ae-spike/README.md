# AE spike: setup and implementation

**Historical test: automatically undoes its work.** The user now wants AE changes retained for review. This runner is disabled by default; use `--verify-undo` only after an explicit request to test undo. For retained edits use the [local bridge](../services/local-bridge/README.md).

## Run

Prerequisites: Windows, Node.js (tested with 24.14.0), After Effects running with exactly one intended project session and a composition active. Close modal dialogs. Avoid editing during the short test. Use a disposable composition for this spike.

From the `creative-os` repository folder:

```powershell
node ae-spike/run.mjs --verify-undo
```

The default executable is `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe`. For a different installation, set the `AE_EXE` environment variable to its absolute executable path. This is a local developer configuration, not remotely supplied input.

AE must allow scripts to write files for result logging. If disabled, the user must enable **Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network**. The script checks write access before changing the project and never alters this preference itself. Adobe combines file and network access in one permission; this spike uses files only. Logging already worked on the tested installation; no permission setting was changed.

Run the local result-validation tests without AE:

```powershell
node --test ae-spike/validate.test.mjs
```

Optional manual dispatch fallback:

```powershell
node ae-spike/run.mjs --verify-undo --prepare
```

Run the generated `runs/<run-id>/g0.jsx` through **File > Scripts > Run Script File** in AE. The source template `g0.jsx` is not directly runnable because the harness injects the run-specific log path. Manual preparation does not certify a pass and retains `runs/active.lock`; inspect its referenced log and AE state before manually clearing that lock. The normal automated runner validates results and clears the lock only on a pass or a known safe failure.

## Why this mechanism

Adobe's [current scripting documentation](https://helpx.adobe.com/after-effects/desktop/automate-in-after-effects/automate-animation/scripts.html), checked September 17, 2026, documents ExtendScript and Windows `afterfx -r <script.jsx>` execution in an existing instance. That is the smallest supported path for project/layer/property manipulation. We verified it on the installed host rather than inferring AE capabilities from another Adobe app.

A CEP panel would add installation and panel lifecycle work. A native plug-in would add a build toolchain. Neither is needed for these five operations. Adobe's [UXP guide](https://developer.adobe.com/uxp/guides/) describes UXP-enabled hosts; we do not assume Photoshop/Premiere UXP APIs apply to AE. This spike makes no broad claim about all possible AE extension routes.

## Files and safeguards

- `g0.jsx`: ES3-compatible fixed sequence using AE's ExtendScript object model. Match names (`ADBE Transform Group`, `ADBE Position`, `ADBE Text Document`) avoid translated property labels.
- `run.mjs`: generates a uniquely identified local script and manifest, dispatches with `spawn` and `shell:false`, waits up to 45 seconds for complete JSONL evidence, and validates it. It does not accept arbitrary script paths or source strings.
- `validate.mjs`: checks all five events, order, run identity, text, layer identity, Position readback, and undo evidence. The AE process exit code is not evidence of success.
- `validate.test.mjs`: positive evidence and nine rejection cases, including preservation and ordering of existing layers.
- `runs/`: ignored local evidence, including generated script, source SHA-256 manifest, timestamped event log, and validation result.
- `evidence/`: retained logs/manifests/results from this session; generated scripts with machine-specific paths are not copied here.

Creation and movement are inside one `Creative OS G0` undo group. `app.executeCommand(16)` invokes native Undo on the tested host; this numeric menu command is an empirical, host-specific dependency. Post-undo layer ID comparison is mandatory. The code does not emulate undo by deleting a layer or resetting Position.

If an error occurs after mutation and before the normal undo, the script closes its group, attempts one undo, and verifies restoration. It never issues a second undo after the normal undo has already been attempted. Missing active composition fails before mutation. A file-write failure fails before mutation. Failure reporting records whether mutation occurred and whether cleanup succeeded.

A local exclusive lock prevents concurrent runs from this repository. Timeout retains the lock because AE might have a delayed script pending behind a dialog. Do not blindly rerun or remove a lock. First inspect the log and AE, resolve/dismiss the blocked script, and establish that no pending dispatch remains. A timeout is an unknown outcome, never a pass; the harness does not kill AE.

## Limits

G0 proves this fixed five-operation cycle on the tested installation. It is not a general command bridge or production reliability guarantee. Other versions, locales, multiple AE instances, restart recovery, and complex projects are untested. Only a newly created, unparented text layer is moved; existing animated or separated Position properties are out of scope.

The live composition began empty. The validator tests non-empty layer-ID preservation, but that is not a live complex-project test. Undo restores the composition's layer list; it does not promise to restore selection, project dirty status, ID allocation, or the user's prior redo stack. A successful run leaves a redoable Creative OS group. The script does not save, close, or replace the user's project.

The harness is local developer code. Anyone who can edit the repository can change its scripts. There is no network execution endpoint or arbitrary network-accessible script execution.
