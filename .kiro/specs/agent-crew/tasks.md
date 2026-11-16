# Tasks — Aivaro Agent Crew

Spec type: implementation task list
Last updated: 2026-11-16
Window: 18 days (2026-11-16 → 2026-12-04)
Status: not started

---

## Task conventions

- Each task maps to a reviewable unit of work (a module, a test suite, or a docs update).
- Status values: `[ ]` not started · `[~]` in progress · `[x]` done
- Effort estimates are in half-days (1 = ~4 hours focused work).
- Dependencies are listed as task IDs in `needs:`.

---

## Phase 0 — Project scaffold (Day 1)

### T-01 · Repository scaffold
Effort: 0.5 · Needs: —
- [x] `README.md`, `LICENSE`, `.gitignore`
- [x] `.kiro/specs/agent-crew/requirements.md`
- [x] `.kiro/specs/agent-crew/design.md`
- [x] `.kiro/specs/agent-crew/tasks.md`
- [x] `.kiro/steering/product.md`

### T-02 · Python package skeleton
Effort: 0.5 · Needs: T-01
- [ ] `pyproject.toml` with `[project]`, `[project.optional-dependencies]`, and `[project.scripts]`
- [ ] `src/aivaro_crew/__init__.py` with version string
- [ ] `src/aivaro_crew/models.py` — all dataclasses from design.md
- [ ] Empty module stubs for each file in the module map
- [ ] `tests/__init__.py`
- [ ] Confirm `pip install -e ".[dev]"` succeeds and `aivaro-crew --help` prints usage

---

## Phase 1 — Core data layer (Days 2–4)

### T-03 · Audit log
Effort: 1 · Needs: T-02
- [ ] `src/aivaro_crew/audit.py`
- [ ] `init_db()` creates the schema (idempotent)
- [ ] `log(event: AuditEvent)` appends a row; raises on write failure
- [ ] No UPDATE or DELETE paths exist in the module
- [ ] Unit tests: schema creation, append, read-back, write-failure raises

### T-04 · Crew file parser
Effort: 1 · Needs: T-02
- [ ] `parse_crew(path: str) -> CrewDef` using PyYAML + Pydantic validation
- [ ] Error messages identify the failing field by name
- [ ] Rejects duplicate agent IDs
- [ ] Rejects unknown tool names (against a stub registry)
- [ ] Unit tests: valid file, duplicate IDs, unknown tool, missing required field

---

## Phase 2 — Approval Gateway (Days 4–6)

### T-05 · Hash protocol
Effort: 0.5 · Needs: T-02
- [ ] `gateway.hash_payload(payload: dict) -> str`
  - `json.dumps(payload, sort_keys=True, ensure_ascii=True)` → UTF-8 → SHA-256 hex
- [ ] Unit tests:
  - Same payload same order → same hash
  - Same payload different insertion order → same hash (sort_keys)
  - Mutated value → different hash
  - Extra key → different hash

### T-06 · Gateway request flow
Effort: 1 · Needs: T-05, T-03
- [ ] `gateway.request(proposal, approval_config) -> ApprovalRecord`
- [ ] CLI mode: print action type, target, hash; block on `y`/`n` input
- [ ] Auto-approve-safe mode: approve if `action_type in safe_actions`, else fall through to CLI
- [ ] MCP mode: stub that calls `mcp_client.call_tool("approve", ...)` (wired fully in T-11)
- [ ] `Rejected` exception raised on `n`; audit log call included
- [ ] Unit tests with monkeypatched stdin for `y` and `n` paths

---

## Phase 3 — Executor and tool registry (Days 6–9)

### T-07 · Tool registry
Effort: 0.5 · Needs: T-02
- [ ] `tools/__init__.py` — `REGISTRY: dict[str, Callable]`
- [ ] `tools/fs.py` — `read_file(path)` and `write_file(path, content)` sandboxed to CWD
- [ ] `tools/web.py` — `web_search(query)` and `fetch_url(url)` (live stubs; return empty results)
- [ ] Registry raises `UnknownToolError` for unregistered names
- [ ] Unit tests: registry lookup, sandbox enforcement for `write_file`

### T-08 · Action executor
Effort: 1 · Needs: T-05, T-07, T-03
- [ ] `executor.execute(proposal, approval) -> dict`
- [ ] Re-hash `proposal.payload`; raise `HashMismatchError` if it differs from `approval.proposal_hash`
- [ ] Look up tool in registry; call it; return result
- [ ] Catch all tool exceptions; log `action_failed`; return error dict (never re-raise)
- [ ] Log `action_executed` on success
- [ ] Unit tests: success path, hash mismatch abort, tool exception handling

---

## Phase 4 — Agent and Orchestrator (Days 9–12)

### T-09 · Agent module
Effort: 1.5 · Needs: T-02, T-07
- [ ] `Agent(agent_def: AgentDef, mock: bool)`
- [ ] `agent.step(goal: str, context: list[dict]) -> list[ActionProposal]`
- [ ] Live path: formats a prompt; calls OpenAI (imported lazily); parses response for action proposals
- [ ] Mock path: delegates to `mock.fixtures` lookup; raises `MissingFixtureError` if entry absent
- [ ] Tool scope enforcement: proposals outside `agent_def.tools` are dropped with a warning log
- [ ] Unit tests: mock path fixture lookup, tool scope enforcement

### T-10 · Orchestrator
Effort: 1.5 · Needs: T-09, T-06, T-08, T-03, T-04
- [ ] `orchestrator.run(crew: CrewDef, mock: bool) -> RunSummary`
- [ ] Sequential loop over `crew.agents`
- [ ] Accumulates `context` list between agents
- [ ] Calls gateway then executor for each proposal; handles `Rejected` without crashing
- [ ] Logs `run_start` and `run_end` with totals
- [ ] Returns `RunSummary(run_id, agents_run, approved, rejected, errors)`
- [ ] Integration test: mock crew end-to-end (no LLM, no network)

---

## Phase 5 — CLI and example (Days 12–14)

### T-11 · CLI entrypoint
Effort: 1 · Needs: T-10, T-04
- [ ] `cli.py` with `@click.group()` and `run` subcommand
- [ ] Options: `--mock`, `--dry-run`, `--log-level`
- [ ] `--dry-run`: parse + validate + print plan; exit 0; no DB write
- [ ] On completion: print run summary and audit DB path
- [ ] Confirm `aivaro-crew run examples/research-crew.yaml --mock` runs end-to-end

### T-12 · Research crew example
Effort: 0.5 · Needs: T-11
- [ ] `examples/research-crew.yaml` — three-agent research crew (researcher, analyst, writer)
- [ ] `src/aivaro_crew/mock/fixtures.py` — fixture entries for all three agents
- [ ] Full mock demo produces clean output with no errors

---

## Phase 6 — MCP adapter (Days 14–15)

### T-13 · Aivaro MCP adapter
Effort: 1 · Needs: T-07
- [ ] `mcp_client.py` with `call_tool(tool_name, params) -> dict`
- [ ] Reads `AIVARO_MCP_URL`; health-checks on first call
- [ ] Falls back to stub on missing var or connection error; logs one INFO line
- [ ] Wire MCP approval path in `gateway.py` (replace stub from T-06)
- [ ] Unit tests: stub path (no env var), stub path (connection refused)

---

## Phase 7 — Polish and submission (Days 15–18)

### T-14 · Test coverage pass
Effort: 1 · Needs: T-01 through T-13
- [ ] Run `pytest --tb=short` and fix all failures
- [ ] Confirm gateway hash tests, mock engine tests, and executor hash-mismatch tests all pass
- [ ] Add any missing edge-case tests identified during review

### T-15 · Documentation pass
Effort: 0.5 · Needs: T-14
- [ ] Review README for accuracy against implemented behaviour
- [ ] Add `CONTRIBUTING.md` with setup instructions
- [ ] Confirm all `pyproject.toml` metadata is correct (version, description, Python constraint)

### T-16 · Final demo verification
Effort: 0.5 · Needs: T-15
- [ ] Clean install in a fresh virtualenv
- [ ] `aivaro-crew run examples/research-crew.yaml --mock` completes without error
- [ ] `aivaro-crew run examples/research-crew.yaml --dry-run` prints plan and exits 0
- [ ] Audit DB exists and contains expected event rows after a mock run
- [ ] Record the demo in `DEMO.md` with exact commands and expected output

---

## Milestone summary

| Milestone | Target day | Tasks |
|---|---|---|
| Scaffold complete | Day 1 | T-01, T-02 |
| Data layer done | Day 4 | T-03, T-04 |
| Gateway done | Day 6 | T-05, T-06 |
| Executor done | Day 9 | T-07, T-08 |
| Agents + Orchestrator done | Day 12 | T-09, T-10 |
| CLI + example running | Day 14 | T-11, T-12 |
| MCP adapter done | Day 15 | T-13 |
| Submission ready | Day 18 | T-14, T-15, T-16 |
