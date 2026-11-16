# Aivaro Agent Crew · Kiroween 2026

**New standalone project started during Kiroween 2026.** Local-first agent workflow prototype with explicit action approval, a SQLite event log, a visual mission-control demo and a separate experimental Ed25519 capability verifier.

> **Pre-alpha / mock crew with a separate opt-in real read demo.** The three agents and their outputs are scripted fixtures, not live AI inference. Approvals in the demo are simulated. Live tool execution is disabled by the crew CLI; the exported library is not a security sandbox. No Android approval, signed phone receipt or production MCP execution is connected yet.

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
| Ed25519 capability gate | Unit-tested signatures, expiry and durable nonce replay guard; **wired to allowlisted live read_file only** |
| Android Agent Approval | Planned external integration, not implemented |
| Kiro Crew application | Not implemented |

## Security boundaries

The crew mock workflow does not perform real tool I/O. A signed capability gate is wired to a separate local read-only demo, but signing with its ephemeral test key is **not Android user consent**. Do not expose the dashboard, run untrusted crew definitions, or enable live tools without an independent security review. See [security review](docs/SECURITY_REVIEW.md).

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

### Standalone audit history

Mission Control now lists previous demo runs from its local SQLite database and allows selecting a run to inspect its persisted action timeline. `GET /api/runs` returns the most recent run summaries; `GET /api/run/:id` returns events for a known run. These endpoints are loopback-only and **not** a remote authentication interface. Set `AIVARO_CREW_DB_PATH` to choose an isolated local audit database. GitHub Actions runs Node 24 tests, CLI dry-run and mock demo.

### Interactive signed read (local demonstration)

Run `node demos/signed-read.js README.md` in a real terminal. Review the exact file and SHA-256 hash, then type **YES** to issue an ephemeral Ed25519 capability and perform a real, read-only action. Anything else denies. This does **not** use Android, persistent key enrollment, or a production sandbox. The demo key is created locally for each invocation, and filesystem symlink checks are not race-free. Never run against an untrusted writable workspace.


### Real Kiro AI incident triage (synthetic, read-only)

Run `node demos/kiro-incident.js --sample` to invoke the authenticated **Kiro CLI** model on a bundled synthetic Kubernetes CrashLoopBackOff/OOM incident. Unlike the scripted three-agent dashboard, the recommendation is **genuinely generated by a model**, then its input/output hashes and a bounded summary are recorded in the SQLite audit. This demo performs **no Kubernetes, shell, MCP or file-modifying actions**; proposed remediation requires separate human authorization. Requires a locally installed, signed-in `kiro-cli`. The `--sample` flag is mandatory; arbitrary user files are deliberately unsupported. This is a single real model-backed triage agent, not yet a model-backed multi-agent crew.

### Two real Kiro agents: diagnosis + independent safety review

Run `node demos/kiro-crew.js --sample` with a signed-in Kiro CLI. The first real model call diagnoses a **synthetic** Kubernetes incident. A second real model call independently challenges the first answer and highlights unsafe remediations. Both model calls are audited separately with SHA-256 input/output hashes in the same run. The reviewer is a separate model invocation, **not** an independent security boundary; it does not approve or execute anything. No cluster or shell tools are invoked. The existing three-agent dashboard remains scripted.

Mission Control (`npm run dashboard`) can now inspect **previously completed real Kiro runs** from the same SQLite database using the history dropdown. Select `Kiro Two-Agent Incident Review` to see the actual investigator/reviewer output and audit timeline. The dashboard's Run button **still launches only the scripted mock crew**; it cannot trigger model calls or execute cluster actions.

### Kiro → human review → signed plan proof (no cluster mutations)

Run `node demos/kiro-approval-proof.js --sample` in an **interactive terminal**. Two real Kiro model calls diagnose and critique a synthetic Kubernetes incident. The program constructs a deterministic, explicitly **non-executable** remediation-review proposal bound to both model output hashes. The human may type `YES` to approve **the plan for further review**, not a cluster action. A temporary local Ed25519 key signs the exact proposal; the demo verifies the signature and proves that replay and payload substitution are rejected, with audit events. The signer and verifier run in the **same local process**, so this is a cryptographic demonstration, **not independent human identity, phone consent, or a production authorization boundary**. No Kubernetes, MCP or shell commands are executed.

### Kiroween Mission Control showcase

`npm run dashboard` opens a redesigned local-only audit experience with agent graph, evidence timeline, real Kiro run history, and visible safety boundaries. To populate genuine model history first, run `node demos/kiro-crew.js --sample` in a separate terminal and select its run from the audit explorer. The green button deliberately triggers **mock only**, not real Kiro or signing. For a signed approval proof use the separate interactive CLI.

### Interactive browser plan proof (demo only)

Open Mission Control, select a completed **Kiro Two-Agent Incident Review** run, click **PREPARE REVIEW PLAN**, inspect the exact non-executable proposal, then choose **DENY** or **APPROVE PLAN ONLY**. The latter uses an ephemeral same-process Ed25519 signer and verifies replay/tamper rejection; all results appear in the audit timeline. A one-use browser decision token expires in 120 seconds. This is **not** authenticated consent, Android device signing, or authority to execute any remediation. Browser API requires a matching local `Origin`, JSON content type and valid Host. Run `node demos/kiro-crew.js --sample` to create a fresh model-backed run before opening the UI.
