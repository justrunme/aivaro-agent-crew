# Tasks — Aivaro Agent Crew

Spec type: implementation task list
Last updated: 2026-11-16
Window: 18 days (2026-11-16 → 2026-12-04)
Stack: Node.js ≥ 22 · ESM (`"type": "module"`) · zero npm dependencies

> **Note:** This project is implemented in Node.js ESM, not Python.
> There is no `pyproject.toml` and no `pip install` step.
> `npm test` runs all tests; `npm run dashboard` starts the local demo UI.

---

## Task conventions

- Each task maps to a reviewable unit of work (a module, a test suite, or a docs update).
- Status values: `[ ]` not started · `[~]` in progress · `[x]` done
- Effort estimates are in half-days (1 = ~4 hours focused work).
- Dependencies are listed as task IDs in `needs:`.

---

## Phase 0 — Project scaffold

### T-01 · Repository scaffold
Effort: 0.5 · Needs: —
- [x] `README.md`, `LICENSE`, `.gitignore`
- [x] `package.json` — `"type": "module"`, `"engines": {"node": ">=22.0.0"}`, scripts `test` and `dashboard`, no runtime npm dependencies
- [x] `.kiro/specs/agent-crew/requirements.md`
- [x] `.kiro/specs/agent-crew/design.md`
- [x] `.kiro/specs/agent-crew/tasks.md`
- [x] `.kiro/steering/product.md`
- [x] `examples/research-crew.yaml`

---

## Phase 1 — Core data layer

### T-02 · Data models
Effort: 0.5 · Needs: T-01
- [x] `src/models.js` — plain JS object factories and error classes
  - `makeAuditEvent`, `makeActionProposal`, `makeApprovalRecord`, `makeCrewDef`, `makeRunSummary`
  - Error classes: `RejectedError`, `HashMismatchError`, `UnknownToolError`, `MissingFixtureError`

### T-03 · Audit log
Effort: 1 · Needs: T-02
- [x] `src/audit.js`
- [x] `initDb(dbPath?)` — opens or creates SQLite at `~/.aivaro-crew/audit.db` (idempotent); uses `node:sqlite` (Node ≥ 22.5), no external packages
- [x] `logEvent(db, fields)` — appends a row; throws on write failure; no UPDATE or DELETE paths exist
- [x] `getRunEvents(db, run_id)` — read helper used by CLI summary and tests
- [x] Unit tests: `tests/test_audit.js` — schema creation, append, read-back, write-failure path

### T-04 · Crew file parser
Effort: 1 · Needs: T-02
- [x] `src/parser.js` — hand-rolled recursive-descent YAML parser; no npm packages
  - Covers: block mappings, block sequences, inline sequences `[a, b]`, quoted strings, booleans, integers, comments
- [x] `parseCrew(filePath)` — reads file, parses, validates via `makeCrewDef`
  - Rejects duplicate agent IDs
  - Rejects unknown tool names (checked against `KNOWN_TOOLS` from tool registry)
  - Error messages name the failing field
- [x] Unit tests: `tests/test_parser.js` — valid file, duplicate IDs, unknown tool, missing field

---

## Phase 2 — Approval Gateway

### T-05 · Hash protocol
Effort: 0.5 · Needs: T-02
- [x] `gateway.hashPayload(payload)` in `src/gateway.js`
  - Recursively sorts object keys → `JSON.stringify` → UTF-8 → SHA-256 hex (`node:crypto`)
  - Uses JavaScript JSON serialization; Python `ensure_ascii` equivalence has not been verified
- [x] Unit tests: `tests/test_gateway.js`
  - Same payload same order → same hash
  - Same payload different insertion order → same hash
  - Mutated value → different hash
  - Extra key → different hash

### T-06 · Gateway request flow
Effort: 1 · Needs: T-05, T-03
- [x] `requestApproval(proposal, approvalConfig, db, clock, opts)` in `src/gateway.js`
- [x] Gateway always recomputes the hash — never trusts an agent-supplied hash
- [x] Auto-approve-safe mode: approves immediately if `action_type` is in `safe_actions`
- [x] MCP mode: delegates to `mcp_client.callTool`; validates `verified === true` + exact hash match; falls through to CLI if MCP is unavailable or returns unverified result
- [x] CLI mode: prints approval banner (agent, action, payload, hash); blocks on `y`/`n`
- [x] `RejectedError` thrown (and audit event written) on `n` or anything non-`y`
- [x] `stdin`/`stdout` overrideable via `opts` for testing without TTY
- [x] Unit tests: `tests/test_gateway.js` — `y` path, `n` path, auto-approve-safe, hash tamper rejected, MCP stub fallback

---

## Phase 3 — Executor and tool registry

### T-07 · Tool registry
Effort: 0.5 · Needs: T-02
- [x] `src/tools/index.js` — `REGISTRY` Map and `getTool(name)` / `KNOWN_TOOLS` Set
- [x] `src/tools/fs.js` — `readFileTool` and `writeFileTool` sandboxed to `process.cwd()` (lexical path traversal check; symlink-safe sandboxing is a known gap — see SECURITY_REVIEW.md)
- [x] `src/tools/web.js` — `webSearch` and `fetchUrl` **live stubs** (return empty results with a note; never called in mock mode)
- [x] `getTool` throws `UnknownToolError` for unregistered names
- [x] Unit tests: `tests/test_mock_engine.js` — registry lookup, sandbox enforcement for `write_file`

### T-08 · Action executor
Effort: 1 · Needs: T-05, T-07, T-03
- [x] `execute(proposal, approval, db, clock, opts)` in `src/executor.js`
- [x] Re-hashes payload before execution; returns error dict with `reason: 'hash_mismatch'` if hashes differ (does not throw, per FR-4.4)
- [x] Validates that `approval` has `approved_at` and `approved_by` fields (rejects unsigned/empty approval objects)
- [x] Mock path (`opts.mock = true`): returns `opts.mockResult` directly, calls no real tool
- [x] Live path: looks up tool in registry and calls it
- [x] Catches all tool exceptions; logs `action_failed`; returns error dict (never re-raises)
- [x] Logs `action_executed` on success
- [x] Unit tests: `tests/test_executor.js` — success, hash mismatch abort, tool exception handling, mock path

---

## Phase 4 — Agent and Orchestrator

### T-09 · Agent module
Effort: 1 · Needs: T-02, T-07
- [x] `src/agent.js` — `Agent(agentDef, mock)` class
- [x] `agent.step(goal, context, run_id, stepIndex)` → `ActionProposal[]`
- [x] **Mock path** implemented: fixture lookup by `${agent_id}:${stepIndex}` key; returns `[]` when no fixture found (agent is done); no `MissingFixtureError` on a missing step key
- [x] **Live LLM path is NOT implemented.** The live branch writes a warning to stderr and returns `[]`. No OpenAI or other LLM client is imported.
- [x] Tool scope enforcement: proposals whose `action_type` is not in `agentDef.tools` are dropped with a stderr warning

### T-10 · Orchestrator
Effort: 1.5 · Needs: T-09, T-06, T-08, T-03, T-04
- [x] `runCrew(crew, db, clock, opts)` in `src/orchestrator.js`
- [x] Sequential loop over `crew.agents`; each agent runs until it produces zero proposals
- [x] Accumulates `context` list between agents
- [x] Calls gateway then executor for each proposal; handles `RejectedError` without crashing
- [x] Logs `run_start` and `run_end` with totals
- [x] Returns `RunSummary(run_id, agents_run, approved, rejected, errors)`
- [x] Integration test: `tests/test_orchestrator.js` — full mock crew end-to-end (no LLM, no network, stdin stubbed to 'y')

---

## Phase 5 — CLI and example

### T-11 · CLI entrypoint
Effort: 1 · Needs: T-10, T-04
- [x] `src/cli.js` — `node:util` `parseArgs`; registered as `bin.aivaro-crew` in `package.json`
- [x] Subcommand `run <crew-file>` with options: `--mock`, `--dry-run`, `--log-level`, `--help`
- [x] `--dry-run`: parse + validate + print plan; exits 0; no DB write
- [x] On completion: prints run summary and audit DB path
- [x] **Live execution blocked at CLI boundary:** running without `--mock` prints an error and exits with code 2. This is a deliberate pre-alpha safety constraint, not a missing feature.
- [x] `aivaro-crew run examples/research-crew.yaml --mock` runs end-to-end (all approvals are from stdin; use `--approval-mode auto-approve-safe` or pipe `y` for unattended demo)

### T-12 · Research crew example and fixtures
Effort: 0.5 · Needs: T-11
- [x] `examples/research-crew.yaml` — three-agent research crew (researcher, analyst, writer)
- [x] `src/mock/fixtures.js` — fixture entries for `researcher:0`, `researcher:1`, `analyst:0`, `writer:0`
- [x] `src/mock/clock.js` — `liveClock()` and `mockClock(startMs?)` (deterministic, epoch advances 1 s per call)
- [x] Full mock demo runs without errors; output is deterministic modulo wall-clock log lines

---

## Phase 6 — MCP adapter

### T-13 · Aivaro MCP adapter
Effort: 1 · Needs: T-07
- [x] `src/mcp_client.js` — `callTool(toolName, params)` always resolves; never throws
- [x] Reads `AIVARO_MCP_URL`; logs one INFO line when env var is absent or when live path is not yet implemented
- [x] **Always stubs in this build** — returns `{ status: 'mcp_unavailable', tool: toolName }` whether or not `AIVARO_MCP_URL` is set. Live MCP tool calls are not implemented.
- [x] Gateway MCP path falls through to CLI when stub returns `mcp_unavailable`
- [x] Unit tests: `tests/test_gateway.js` — MCP stub path confirmed

### T-13b · Aivaro discovery (read-only)
Effort: 0.5 · Needs: T-13
- [x] `src/aivaro_discovery.js` — `discoverAivaroTools({ timeoutMs })` spawns the user's local Aivaro adapter and calls `tools/list` via JSON-RPC; returns tool names and descriptions
- [x] **Discovery only — `tools/call` is never sent.** This is not full MCP execution integration.
- [x] Degrades gracefully (returns `{ status: 'unavailable', tools: [] }`) on timeout, missing adapter binary, or error response

---

## Phase 7 — Security prototype

### T-14 · Signed capability prototype
Effort: 1.5 · Needs: T-06, T-08
- [x] `src/security/capabilities.js` — Ed25519 signed, time-limited, one-time capability claims
  - `proposalDigest(proposal)` — SHA-256 of `{run_id, agent_id, action_type, payload_hash}` canonical JSON
  - `issueCapability(proposal, privateKey, opts)` — issues a signed claim with nonce, TTL, and proposal digest
  - `verifyCapability(proposal, capability, publicKey, opts)` — verifies signature, TTL, proposal match, and consumes nonce
  - `generateDemoSigner()` — generates an ephemeral Ed25519 key pair for tests only
- [x] `src/security/replay_store.js` — `createReplayStore(db)` atomically inserts nonce into SQLite; returns `false` if already consumed (replay detection across process restarts)
- [x] `src/security/verified_gateway.js` — `authorizeSignedProposal(proposal, capability, trustedPublicKey, db, opts)` — composes the above; returns `{ok, reason}`
- [x] Unit tests: `tests/test_capabilities.js`, `tests/test_verified_gateway.js` — tamper, expiry, replay, wrong-key, missing-trust-config
- **Critical limitation:** `generateDemoSigner()` produces an ephemeral local test key. This is not an Android Keystore identity, a device-paired key, or any form of real user consent. No device pairing, attestation, or approval-card transport is implemented.

---

## Phase 8 — Dashboard

### T-15 · Mission control dashboard (mock only)
Effort: 1 · Needs: T-12
- [x] `dashboard/server.js` — HTTP server on `127.0.0.1:4317`; validates `Host` and `Origin` headers; serves `dashboard/index.html` and selected audit events
- [x] `dashboard/index.html` — single-page UI; "Run safe demo" button triggers a mock crew run; displays three scripted agents, simulated approvals, and an audit timeline
- [x] **Mock only.** The dashboard cannot call MCP tools, does not execute filesystem writes, and does not issue real approvals. Approval counts are simulated.
- [x] No authentication. Bound to 127.0.0.1 only. Do not expose to a network or reverse-proxy.

---

## Phase 9 — Polish and submission

### T-16 · Test coverage pass
Effort: 0.5 · Needs: T-01 through T-15
- [x] `npm test` runs all 9 test files via `node --test`
- [x] Tests cover: gateway hash, mock engine, executor (hash mismatch, success, error), orchestrator end-to-end, parser, audit, security/capabilities, verified_gateway
- [ ] Run `npm test` in a clean Node 22 environment and confirm all tests pass
- [ ] Add any missing edge-case tests identified during review

### T-17 · Documentation pass
Effort: 0.5 · Needs: T-16
- [x] `docs/SECURITY_REVIEW.md` — pre-alpha security findings and known limitations
- [x] README updated: quick start uses `npm test` / `npm run dashboard`; mock-only status and Aivaro-as-optional-external-dependency clearly stated
- [ ] `CONTRIBUTING.md` with Node 22 setup instructions and test commands

### T-18 · Final demo verification
Effort: 0.5 · Needs: T-17
- [ ] `node --version` confirms ≥ 22 in the demo environment
- [ ] `npm test` completes without failures
- [ ] `aivaro-crew run examples/research-crew.yaml --mock` completes; audit DB exists at `~/.aivaro-crew/audit.db` with expected event rows
- [ ] `aivaro-crew run examples/research-crew.yaml --dry-run` prints plan and exits 0
- [ ] `npm run dashboard` starts; `http://127.0.0.1:4317` loads and "Run safe demo" completes without JS errors
- [ ] Record exact commands and expected output in `DEMO.md`

---

## Known gaps / out of scope for this entry

| Gap | Notes |
|---|---|
| Live LLM calls | `agent.js` live path not implemented; always returns `[]` with a stderr warning |
| Live tool execution | Blocked at CLI boundary (`exit(2)`) in this build; web tools are stubs |
| Real MCP tool calls | `mcp_client.js` always stubs; `aivaro_discovery.js` is read-only (`tools/list` only) |
| Device-paired signing | `generateDemoSigner()` is ephemeral test key only; no Android Keystore, no device pairing |
| Parallel agent execution | Orchestrator is sequential only |
| Persistent agent memory | No cross-run state beyond the audit DB |
| Symlink-safe sandboxing | `tools/fs.js` path check is lexical only; TOCTOU and symlink traversal not prevented |
| Tamper-evident audit log | Append-only by convention; no cryptographic receipt chain |
| Dashboard auth | No authentication; 127.0.0.1-only binding is the only network control |

---

## Milestone summary

| Milestone | Status | Tasks |
|---|---|---|
| Scaffold complete | ✅ done | T-01 |
| Data layer done | ✅ done | T-02, T-03, T-04 |
| Gateway done | ✅ done | T-05, T-06 |
| Executor done | ✅ done | T-07, T-08 |
| Agents + Orchestrator done | ✅ done | T-09, T-10 |
| CLI + example running | ✅ done | T-11, T-12 |
| MCP adapter done (stub) | ✅ done | T-13, T-13b |
| Security prototype done | ✅ done | T-14 |
| Dashboard done (mock) | ✅ done | T-15 |
| Tests passing | 🔲 pending verification | T-16 |
| Submission ready | 🔲 pending | T-17, T-18 |
