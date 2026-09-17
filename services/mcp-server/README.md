# Local MCP server

This is the first MCP boundary for Creative OS. It uses standard JSON-RPC messages over stdin/stdout, so an MCP-capable client can launch it as a local process. It does not listen on a network port.

Start it from the repository:

```powershell
node services/mcp-server/server.mjs
```

The process exposes thirteen allowlisted tools that map to the local AE bridge: composition and layer inventory, transform/source/text/animation inspection, text creation, Position read/write, Position keyframes, Opacity keyframes, and keyframe readback. It delegates validation, local authentication, replay protection, AE dispatch, and journaling to the existing bridge. Changes remain visible in AE; there is no undo tool and no automatic rollback.

The MCP server never accepts raw JavaScript, arbitrary property paths, arbitrary executable paths, or arbitrary filesystem paths. Tool arguments become structured bridge requests and are validated before dispatch. Errors are returned as structured MCP tool results.

This is intentionally a narrow MCP surface. Full layer inventory, footage import, shape/mask operations, text styling, render comparison, and high-level prompt planning are the next capabilities needed for frame-accurate reconstruction of the supplied example.

The read-only inspection surface now also includes composition state, full transforms, source information for nested compositions/footage, and basic text-document styling.

## Recorded test

The MCP test is part of the repository test command:

```powershell
npm.cmd test
```

It verifies that the server initializes as `creative-os-local-mcp`, advertises exactly the thirteen allowlisted AE tools, and rejects an unknown `eval` tool. This test does not modify After Effects. The live AE bridge tests remain separate and are documented in `DEVELOPMENT-LOG.md`.
