# Creative OS

**Email & Leads interface:** [local setup](apps/outreach/README.md) · [design system](DESIGN.md). Run `npm run outreach:install`, `npm run outreach:build`, then `npm run outreach` and open http://127.0.0.1:47832/. This interface runs separately from After Effects and does not send email.

Current work: [local bridge setup and protocol](services/local-bridge/README.md). Read the [running development log](DEVELOPMENT-LOG.md) for changes and verified status after each step.

**Review preference:** AE changes remain visible. The historic G0 undo test now requires explicit `--verify-undo` opt-in; do not run it without the user's request.

**G0 PASS on this machine: Adobe After Effects 2026, 26.3x87, Windows, en_US.**

The original G0 spike performs five operations in one synchronous script:

1. Get the active composition.
2. Create a text layer containing `Creative OS`.
3. Read that layer's Position.
4. Set Position to its original X + 120, Y + 60, preserving any Z component; read back to verify.
5. Invoke AE's native Undo once, reverting the grouped text creation and movement; verify the original ordered layer IDs are restored.

See [setup and decisions](ae-spike/README.md) and [actual test results](ae-spike/RESULTS.md).

No third-party dependencies to install. The next step adds an authenticated loopback-only bridge. MCP, cloud connectivity, ChatGPT integration, and a polished UI are not included.
