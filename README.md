# Aivaro Agent Crew · Kiroween 2026

**New standalone project started during Kiroween 2026.** Local-first agent workflow prototype with explicit action approval, a SQLite event log, a visual mission-control demo and a separate experimental Ed25519 capability verifier.

> **Pre-alpha / mock-only.** The three agents and their outputs are scripted fixtures, not live AI inference. Approvals in the demo are simulated. Live tool execution is disabled by the CLI; the exported library is not a security sandbox. No Android approval, signed phone receipt or production MCP execution is connected yet.

## Try the working demo

Requirements: Node.js 24+ (tested on Node 26; built-in `node:sqlite` required). No npm install or API key needed.

```bash
git clone https://github.com/justrunme/aivaro-agent-crew.git
cd aivaro-agent-crew
npm test
node src/cli.js run examples/research-crew.yaml --mock
npm run dashboard
```

Open **http://127.0.0.1:4317** on the same computer. Select **Run safe demo** to see three simulated agents, four simulated approvals and a timeline of logged events. Dashboard binds to loopback only. It must not be exposed to the internet.

## What is implemented

| Component | Status |
|---|---|
| New Node.js ESM orchestrator | Scripted three-agent workflow |
| CLI | Mock and dry-run; live execution explicitly disabled |
| Approval gateway | CLI prompt / simulated approvals; not phone-backed |
| Audit | SQLite append-only application writes; **not tamper-evident** |
| Mission Control | Local HTML dashboard for simulated runs |
| Aivaro MCP | Read-only `tools/list` discovery from optional local adapter |
| Ed25519 capability prototype | Unit-tested signatures, expiry and durable nonce replay guard; **not wired to executor** |
| Android Agent Approval | Planned external integration, not implemented |
| Kiro Crew application | Not implemented |

## Security boundaries

The current mock workflow does not perform real tool I/O. A signed capability prototype is provided in `src/security/`, but signing with its ephemeral test key is **not user consent**. Do not expose the dashboard, run untrusted crew definitions, or enable live tools without an independent security review. See [security review](docs/SECURITY_REVIEW.md).

## How Kiro was used

The initial project scaffold and `.kiro/specs/agent-crew/` documents were generated with Kiro CLI. On 16 November Kiro CLI was invoked again to reconcile the implementation task list with the actual Node.js code; that run timed out after partially writing `tasks.md`, which was reviewed and corrected. Subsequent changes must be attributed accurately; development done outside Kiro is **not** claimed as Kiro-generated.

`.kiro/steering/product.md` documents product intent, and `.kiro/specs/agent-crew/` contains requirements, design and a living task list. Real Kiro integration and reproducible evidence of usage remain priorities.

## Pre-existing work disclosure

**Aivaro** (existing macOS local automation/MCP service) and **Agent Approval** (existing Android project) predate this hackathon. They are external integrations and are not presented as new Kiroween code. This repository contains a newly developed prototype, not a repackaging of those applications. The current implementation can be demonstrated without either existing project.

## Roadmap

1. Harden the approval envelope and ensure every execution path requires a verified, persisted one-time capability.
2. Pair a trusted Android Keystore public key, transport Action Cards, verify actual device-signed consent.
3. Implement restricted Aivaro MCP tool calls through the approval gate and an OS sandbox.
4. Upgrade the visual interface to show pending approvals, execution receipts and replayable timelines.
5. Validate all contest requirements, document Kiro-driven contributions, record a sub-three-minute demo and prepare a public release.

License: MIT. This is an experimental prototype, not production security software.

## Kiro development evidence

See [Kiro usage and credit policy](docs/KIRO_USAGE.md). Kiro CLI model execution is verified; the remaining account credit balance is not exposed by the available CLI commands. This project does not claim all source code was authored through Kiro.
