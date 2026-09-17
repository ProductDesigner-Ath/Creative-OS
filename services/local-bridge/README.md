# Local bridge — next step after G0

Run from the repository with Node 22 or later (tested on 24.14.0):

```powershell
npm start
```

In another terminal, inspect AE:

```powershell
npm run inspect
```

AE must be running, with one composition active and no blocking dialogs. File-write scripting permission is required as in G0. The bridge reuses the proven local `AfterFX.exe -r` mechanism; no extension needs installing. `AE_EXE` overrides the installed executable path if necessary.

The server binds **127.0.0.1:47831** only. It requires a bearer token generated in `.local/token`, rejects browser Origin headers and unexpected Host headers, and accepts only JSON up to 16 KB. The client reads the token locally; it is not printed or committed. The token file uses normal local account filesystem permissions on Windows; it does not isolate against other software running as the same user.

## Protocol 0.1

`POST /commands` receives exactly:

```json
{
  "version": "0.1",
  "requestId": "00000000-0000-0000-0000-000000000001",
  "app": "after_effects",
  "operation": "composition.getActive",
  "arguments": {}
}
```

Each new request needs a new UUID. Responses contain `version`, `requestId`, `success`, and either `result` or `error` with `code` and `message`.

| Operation | Arguments |
| --- | --- |
| `composition.getActive` | `{}` |
| `layer.createText` | `context`, `compositionId`, `text` |
| `layer.getPosition` | `context`, `compositionId`, `layerId` |
| `layer.setPosition` | `context`, `compositionId`, `layerId`, `value` |
| `layer.addPositionKeyframes` | `context`, `compositionId`, `layerId`, two increasing `keyframes` |
| `layer.getKeyframes` | `context`, `compositionId`, `layerId`, `property` (`position` or `opacity`) |

The active-composition response supplies a context token. Subsequent commands must use that token, the composition ID, and the returned stable layer ID, not the layer's index. A new active-composition query replaces the context. The AE adapter also checks the active project and composition object references. Restarting AE or changing the active comp invalidates old context. Cross-restart persistence is not promised.

Create Text accepts 1–200 characters. Set Position accepts 2 or 3 finite numbers, with the same dimension count returned by AE, each within +/-100000. It rejects locked layers and animated, separated, or expression-driven Position. These limits intentionally keep this step small.

The adapter uses a fixed operation switch. JSON serialization and escaping keep text as data; there is no `eval`, arbitrary script operation, arbitrary property path, or remotely chosen filesystem path. Undo/delete/reset are not available commands. Mutations are grouped for manual AE undo, but the bridge never undoes changes automatically, including on errors.

## Retained review demo

```powershell
npm run demo:retain
```

This inspects the active comp, creates `Creative OS`, reads Position, moves X + 120 and Y + 60, and reads back the final position. It leaves the text editable in AE. A local marker prevents accidental reruns that would create duplicates or override subsequent manual review edits. The script does not save or close the AE project.

## Logs and retries

`.local/requests/<requestId>/` stores the request receipt, exact generated adapter script, AE start marker, and response. Request IDs provide replay protection: an identical completed request returns its recorded response with `replayed:true`, rather than executing again. It is historical evidence, not a fresh state query. Reusing an ID with a different payload returns `ID_CONFLICT`.

Only one command is dispatched at a time. Busy requests are rejected, not queued. A durable dispatch lock remains after timeouts or unknown outcomes. A request without a response will never be automatically redispatched. Inspect AE and its journal before manually resolving a lock; a script could still be pending behind a dialog. No automatic rollback is performed. Errors after mutation report `changed` and retain the work.

Use `node --test tests/bridge.test.mjs ae-spike/validate.test.mjs` for the test suite. After the retained demo, `node tests/live-retained.mjs` checks replay protection and read-only state preservation against AE. It never intentionally creates another layer or resets review edits. See `DEVELOPMENT-LOG.md` for actual live results and known limitations.

## Scope and limitations

This is a local protocol foundation, not the later AI animation Gate 1 described in the longer roadmap. No MCP, keyframes, generative AI, network tunnel, cloud access, or frontend is included. The service is not installed for automatic startup. Its health endpoint reports service availability only; AE is checked during each command.

AE scripting remains synchronous. Modal dialogs can delay dispatch. Testing is on one Windows AE 26.3x87 English installation. Multiple AE instances, process crashes during mutation, hostile same-user local software, and complex production projects require further work. Local `.local/` runtime data and tokens are ignored by Git.
