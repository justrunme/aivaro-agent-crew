# Requirements — Aivaro Agent Crew

Spec type: functional + non-functional requirements
Last updated: 2026-11-16
Status: draft (Kiroween 2026 entry)

---

## Background

Multi-agent orchestration frameworks exist but consistently make one of two trade-offs:
agents are trusted to act autonomously (unsafe), or the system requires cloud services to function (high friction for experimentation). This project validates that a lightweight, local-first, human-gated orchestrator is feasible within a hackathon time-box.

---

## Stakeholders

| Role | Concern |
|---|---|
| Hackathon reviewer | Can run a full demo without credentials; can read the code and trust the safety claims |
| Developer experimenter | Can define a crew in YAML and plug in real tools without touching orchestrator internals |
| Aivaro platform team | MCP integration is additive and does not couple the core to any proprietary API |

---

## Functional requirements

### FR-1 — Crew definition
- FR-1.1 The system SHALL parse a crew definition from a YAML file supplied at runtime.
- FR-1.2 A crew definition SHALL declare: a name, a goal string, one or more agent definitions, and an approval configuration block.
- FR-1.3 Each agent definition SHALL include: a unique `id`, a `role` description, a list of permitted `tools`, and a `model` identifier (which MAY be `"mock"`).
- FR-1.4 The system SHALL reject crew files that contain duplicate agent IDs or reference tools not registered in the tool registry.

### FR-2 — Orchestration
- FR-2.1 The orchestrator SHALL route the crew goal to agents in the order they appear in the crew file (sequential, single-pass for MVP).
- FR-2.2 Each agent SHALL receive: the crew goal, its own role description, and the accumulated output of all preceding agents in the current run.
- FR-2.3 When an agent produces an action proposal, the orchestrator SHALL pass it to the Approval Gateway before allowing execution.
- FR-2.4 The orchestrator SHALL terminate the run if any agent produces an error that is not retryable, logging the reason to the audit trail.

### FR-3 — Approval Gateway
- FR-3.1 The gateway SHALL compute a SHA-256 hash of the serialised action payload before presenting it to the approver.
- FR-3.2 The system SHALL NOT execute any action unless it holds an approval record whose hash matches the action payload hash computed at execution time.
- FR-3.3 When `approval.mode` is `cli`, the gateway SHALL print the action type, target, and hash to stdout and block until the user enters `y` (approve) or `n` (reject).
- FR-3.4 When `approval.mode` is `mcp`, the gateway SHALL send the proposal to the configured Aivaro MCP server's approval tool and wait for its response.
- FR-3.5 When `approval.mode` is `auto-approve-safe`, the gateway SHALL auto-approve only actions whose `action_type` appears in `approval.safe_actions`; all others go through CLI approval.
- FR-3.6 A rejected action SHALL be logged to the audit trail and SHALL cause the orchestrator to skip that agent's current step and continue.

### FR-4 — Action Executor
- FR-4.1 The executor SHALL only run actions that carry a valid approval record.
- FR-4.2 The executor SHALL re-hash the action payload immediately before execution and abort if the hash does not match the approval record.
- FR-4.3 Execution results SHALL be returned to the orchestrator and appended to the shared context for subsequent agents.
- FR-4.4 Any exception raised during tool execution SHALL be caught, logged to the audit trail, and surfaced to the orchestrator as an error result (never a silent failure).

### FR-5 — Audit log
- FR-5.1 The system SHALL write all events to a SQLite database at `~/.aivaro-crew/audit.db`.
- FR-5.2 Each event record SHALL include: a UUID, a UTC timestamp, the run ID, the event type, the agent ID (if applicable), and a JSON payload.
- FR-5.3 Event types SHALL include at minimum: `run_start`, `run_end`, `action_proposed`, `action_approved`, `action_rejected`, `action_executed`, `action_failed`.
- FR-5.4 The audit database SHALL be append-only within a run; no event record SHALL be deleted or mutated by the system.

### FR-6 — Mock / demo mode
- FR-6.1 When invoked with `--mock`, the system SHALL replace all LLM calls and tool executions with responses loaded from fixture files under `src/aivaro_crew/mock/`.
- FR-6.2 Mock mode SHALL produce deterministic output for a given crew file and fixture set across multiple runs.
- FR-6.3 Mock mode SHALL NOT require any environment variables, API keys, or network access.
- FR-6.4 The approval gateway SHALL still run in mock mode (using CLI mode regardless of crew file setting) so the human-gate behaviour is visible during demos.

### FR-7 — Aivaro MCP integration (optional)
- FR-7.1 When `AIVARO_MCP_URL` is set and the server is reachable, the MCP adapter SHALL make tool calls through the MCP protocol.
- FR-7.2 When `AIVARO_MCP_URL` is unset or the server is unreachable, the system SHALL log one INFO line and continue without MCP.
- FR-7.3 MCP availability SHALL NOT affect the mock demo path.

### FR-8 — CLI
- FR-8.1 The CLI SHALL expose a `run` subcommand: `aivaro-crew run <crew-file> [--mock] [--dry-run] [--log-level LEVEL]`.
- FR-8.2 `--dry-run` SHALL parse and validate the crew file, print the resolved agent plan, and exit without running any agents or writing to the audit DB.
- FR-8.3 On completion, the CLI SHALL print a summary: run ID, number of agents executed, number of actions approved/rejected, and the path to the audit DB.

---

## Non-functional requirements

### NFR-1 — Safety
- The system SHALL be deny-by-default: an action with no approval record is never executed.
- Approval tokens SHALL be non-transferable: a token for action A cannot approve action B, even if B has the same `action_type`.

### NFR-2 — Portability
- The system SHALL run on Python 3.11+ on macOS and Linux.
- The only required system dependency is Python; SQLite is bundled with CPython.

### NFR-3 — Testability
- The gateway hash logic SHALL be unit-testable without a database or LLM.
- The mock engine SHALL be unit-testable without a crew file (fixtures loaded directly).

### NFR-4 — Transparency
- The `.kiro/` directory SHALL be committed and SHALL contain the specs used to build the system.
- The README SHALL state clearly that this is a hackathon prototype and SHALL not claim production readiness.

### NFR-5 — Originality
- No source code SHALL be copied from existing Aivaro, LangChain, CrewAI, or AutoGen repositories.
- Third-party libraries (PyYAML, Click, etc.) are permitted as dependencies.
