# Security review — 2026-11-16 (pre-alpha)

## Scope
Review of mock orchestration, approval, executor, local MCP discovery and local dashboard. **Not a production security certification.**

## Confirmed findings
- **High: agent-supplied action hash was trusted by the approval gateway.** Fixed: gateway recomputes the hash before any approval decision; executor also checks proposal hash and approval metadata. Regression tests added.
- **High: MCP `status: approved` alone was treated as authorization.** Fixed: gateway requires `verified: true` and exact proposal hash match. **No verifier issues such proofs yet**, so MCP cannot approve actions. No live MCP execution enabled.
- **High: real tool execution path was present despite unreviewed filesystem and network tools.** Contained at CLI boundary: live runs are disabled; dashboard runs only deterministic mocks. Internal library calls are **not a security sandbox**.
- **Medium: filesystem path checks are lexical only.** Symlink traversal and TOCTOU are not prevented. No live execution permitted until a real OS sandbox and symlink-safe access are implemented.
- **Medium: audit DB is append-only by application convention, not tamper-evident or OS-enforced.** Add chained receipts/signatures before claiming integrity.
- **Medium: approval hash covers payload only, not agent/run/tool identity or expiry.** Before real execution, bind all fields, nonce, policy and expiry to a signed one-time capability; prevent replay.
- **Medium: dashboard has no authentication.** It is bound to 127.0.0.1, validates Host and Origin, and exposes only a mock trigger and selected audit metadata. Do not reverse-proxy or expose it to a network.
- **Medium: YAML parser is a limited handwritten subset.** Treat crew definitions as trusted local input only.
- **Low: simulated fixture output contains illustrative research claims.** Never present these as verified sources.

## Aivaro MCP integration status
The adapter connects to the existing local Aivaro service and successfully discovers five terminal MCP tools via `tools/list`. `src/aivaro_discovery.js` is discovery-only and never sends `tools/call`. **This is not full Aivaro MCP execution integration**; tool execution and phone approval verification require a separate security-reviewed phase.

## Demo safety boundary
`npm run dashboard` starts a local mock-only UI at 127.0.0.1:4317. It cannot call MCP tools, does not execute filesystem writes and does not issue real approvals. Approval counts are simulated.

## Signed capability prototype (subsequent phase)
`src/security/capabilities.js` supports Ed25519-signed, time-limited, one-time capability claims bound to run, agent, action type and payload digest. `src/security/verified_gateway.js` verifies against a supplied trusted public key and atomically consumes the nonce in SQLite, including across process restarts. Unit tests exercise tampering, expiry, replay and trust failures.

**Critical limitation:** the included `generateDemoSigner()` generates an ephemeral local test key. This is **not** the Android Keystore signing identity or an authenticated phone approval. No device pairing, key registration, attestation, approval-card transport or MCP tool invocation is implemented. Never treat a local demo signature as user consent.

### Live execution gate (November 2026)

`execute()` now rejects live calls unless a trusted Ed25519 capability is supplied and consumed once in SQLite. Only `read_file` is currently allowlisted for live execution; write, network and shell actions are denied regardless of capability. The legacy CLI approval flow remains a mock/demo path and is not a production consent system. `read_file` resolves symlinks before opening; this is **not** race-free OS-level containment. Never run this prototype against an untrusted writable workspace or claim it is a production sandbox. The Android trusted-key enrollment and human consent flow are not yet connected.
