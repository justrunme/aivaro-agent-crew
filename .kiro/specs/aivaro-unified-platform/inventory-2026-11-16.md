# Actual source and MCP discovery — 2026-11-16

Read existing Aivaro `PRODUCT.md`, `VISION.md`, `trust/gate.mjs`, `trust/mobile/protocol.mjs`, Android README, and invoked `discoverAivaroTools()` against the local installed MCP adapter.

**Observed adapter:** `~/.local/share/aivaro-kiro/terminal-stdio.cjs` returned `connected-read-only` and exactly five tools: `terminal_create`, `terminal_send`, `terminal_read`, `terminal_interrupt`, `terminal_close`. This is a `tools/list` discovery, **not** a tested `tools/call` and not evidence that Trust approved execution. No browser/desktop/system tools are exposed through this particular adapter. Aivaro's broader codebase contains them, but Agent Crew does not yet integrate them.

**Actual Trust:** `aivaro/trust/gate.mjs` has `waitPhoneApproval`, rejects local approvals when phone required, rechecks policy and action hash, and handles freeze. `aivaro/trust/mobile/protocol.mjs` uses **P-256/ECDSA**, not Agent Crew's local **Ed25519** demo. Therefore copying Agent Crew capabilities into the Android flow would be protocol-incompatible and unsafe. Reuse the real Aivaro Trust bridge instead.

**Real Android:** `agent-approval/README.md` documents QR pairing, pinned computer SPKI, signed poll/decision/freeze, biometric gates, optional relay, and demo mode. No physical paired phone was tested for this Agent Crew integration.

**Architectural correction:** Use Aivaro's native Trust policy and P-256 signed decision as the authoritative gate. Agent Crew's ephemeral Ed25519 signed-plan proof is strictly educational and cannot authorize Aivaro actions. First integrate a read-only scoped MCP action through a deliberately versioned adapter; prove policy and sandbox before permitting writes.
