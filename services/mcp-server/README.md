# Local MCP server

This is the first MCP boundary for Creative OS. It uses standard JSON-RPC messages over stdin/stdout, so an MCP-capable client can launch it as a local process. It does not listen on a network port.

Start it from the repository:

```powershell
node services/mcp-server/server.mjs
```

The process exposes 22 allowlisted tools that map to the local AE bridge: composition and layer inventory, transform/source/text/animation inspection, text and controlled shape construction, fixed text styling, timing, and transform/keyframe edits. It delegates validation, local authentication, replay protection, AE dispatch, and journaling to the existing bridge. Changes remain visible in AE; there is no undo tool and no automatic rollback.

The MCP server never accepts raw JavaScript, arbitrary property paths, arbitrary executable paths, or arbitrary filesystem paths. Tool arguments become structured bridge requests and are validated before dispatch. Errors are returned as structured MCP tool results.

This is intentionally a narrow MCP surface. Footage import, masks, text animation selectors, render comparison, and high-level prompt planning are the next capabilities needed for frame-accurate reconstruction of the supplied example.

The read-only inspection surface now also includes composition state, full transforms, source information for nested compositions/footage, and basic text-document styling.

## Batch recipe contract

An animation recipe should first call `ae_get_active_composition`, then `ae_get_composition_state` and `ae_get_layers`. It can inspect each candidate with `ae_get_source_info`, `ae_get_text_document`, `ae_get_transform`, and `ae_get_animation_state`, create or animate only the intended layer, and finish with `ae_get_animation_state` verification. Editing operations are limited to text and controlled shape creation, text size/fill/alignment, layer timing, Position setting, and Position/Scale/Rotation/Anchor Point/Opacity keyframes. Every edit is retained in AE for review; rollback is deliberately outside the MCP surface.

## Recorded test

The MCP test is part of the repository test command:

```powershell
npm.cmd test
```

It verifies that the server initializes as `creative-os-local-mcp`, advertises the exact 22-tool allowlist, and rejects an unknown `eval` tool. This test does not modify After Effects. The live AE bridge tests remain separate and are documented in `DEVELOPMENT-LOG.md`.
