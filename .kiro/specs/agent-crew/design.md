# Design — Aivaro Agent Crew

Spec type: technical design
Last updated: 2026-11-16
Status: draft (Kiroween 2026 entry)

---

## Overview

The system is a Python CLI application with five core modules and one optional adapter.
All modules communicate through explicit data classes (no shared mutable globals).
The SQLite audit log is the only persistent side effect; everything else is in-process.

---

## Module map

```
src/aivaro_crew/
├── __init__.py
├── cli.py           # Click entrypoint; parses args; wires modules together
├── models.py        # Shared dataclasses: CrewDef, AgentDef, ActionProposal, ApprovalRecord, AuditEvent
├── orchestrator.py  # Runs the crew; routes messages; calls gateway then executor
├── agent.py         # Wraps a single agent; calls LLM or mock; produces ActionProposals
├── gateway.py       # Hashes proposals; prompts for approval; returns ApprovalRecord or raises Rejected
├── executor.py      # Validates ApprovalRecord hash; runs the tool; returns result
├── audit.py         # SQLite writer; schema init; append-only event log
├── mcp_client.py    # Optional: wraps AIVARO_MCP_URL; falls back to stub
├── tools/
│   ├── __init__.py  # Tool registry: maps name → callable
│   ├── fs.py        # read_file, write_file (sandboxed to working dir)
│   └── web.py       # web_search, fetch_url (stubbed in mock mode)
└── mock/
    ├── __init__.py
    ├── clock.py     # Deterministic clock for reproducible timestamps
    └── fixtures.py  # Scripted LLM responses and tool results keyed by (agent_id, step)
```

---

## Data model

### `CrewDef`
```
name: str
goal: str
agents: list[AgentDef]
approval: ApprovalConfig
```

### `AgentDef`
```
id: str
role: str
tools: list[str]
model: str           # "mock" | model identifier
```

### `ApprovalConfig`
```
mode: Literal["cli", "mcp", "auto-approve-safe"]
safe_actions: list[str]
```

### `ActionProposal`
```
run_id: str
agent_id: str
action_type: str     # e.g. "write_file", "web_search"
payload: dict        # exact parameters; this dict is what gets hashed
payload_hash: str    # SHA-256 hex of json.dumps(payload, sort_keys=True, ensure_ascii=True)
```

### `ApprovalRecord`
```
proposal_hash: str   # must equal ActionProposal.payload_hash at execution time
approved_by: str     # "cli:<username>" | "mcp:<token>" | "auto-safe"
approved_at: str     # ISO 8601 UTC
```

### `AuditEvent`
```
event_id: str        # UUID4
run_id: str
occurred_at: str     # ISO 8601 UTC
event_type: str      # see FR-5.3
agent_id: str | None
payload: dict        # event-specific data
```

---

## Control flow

```
cli.py: run()
  │
  ├─ parse_crew(path) → CrewDef
  ├─ audit.init_db()
  ├─ audit.log(run_start)
  │
  └─ orchestrator.run(crew, mock=False)
       │
       ├─ context = []
       │
       └─ for agent_def in crew.agents:
            │
            ├─ agent = Agent(agent_def, mock=mock)
            ├─ proposals = agent.step(crew.goal, context)
            │
            └─ for proposal in proposals:
                 │
                 ├─ audit.log(action_proposed)
                 │
                 ├─ approval = gateway.request(proposal, crew.approval)
                 │   ├─ (approved) → audit.log(action_approved) → return ApprovalRecord
                 │   └─ (rejected) → audit.log(action_rejected) → raise Rejected
                 │
                 └─ result = executor.execute(proposal, approval)
                      ├─ re-verify hash (abort if mismatch)
                      ├─ call tool
                      ├─ audit.log(action_executed | action_failed)
                      └─ return result
```

---

## Gateway hash protocol

1. Serialise `proposal.payload` with `json.dumps(payload, sort_keys=True, ensure_ascii=True)`.
2. Encode as UTF-8 bytes.
3. Compute `hashlib.sha256(encoded).hexdigest()`.
4. Store as `ActionProposal.payload_hash`.
5. At execution time, repeat steps 1–3 from the live `proposal.payload` and compare to `approval.proposal_hash`. Abort if they differ.

This binds approval to the exact byte representation of the payload, not a human-readable summary. Any mutation (extra key, changed value, different ordering that `sort_keys` would not normalise) is detected.

---

## Mock engine

`fixtures.py` holds a dict keyed by `(agent_id, step_index)`:

```python
FIXTURES: dict[tuple[str, int], FixtureEntry] = {
    ("researcher", 0): FixtureEntry(
        llm_response="I will search for recent papers on formal verification of LLM outputs.",
        action=ActionProposal(
            action_type="web_search",
            payload={"query": "formal verification LLM outputs 2025"},
            ...
        ),
        tool_result={"results": [{"title": "...", "url": "..."}]},
    ),
    ...
}
```

The mock `Agent.step()` looks up `(agent_id, step_index)`, returns the fixture's `action`, and the mock `executor.execute()` returns the fixture's `tool_result` without calling any external system. The gateway still runs — the demo shows the approval prompt even in mock mode.

The deterministic clock (`mock/clock.py`) is injected via a simple callable parameter so production code uses `datetime.utcnow()` and tests/mock use a fixed sequence.

---

## Aivaro MCP adapter

`mcp_client.py` exposes a single function:

```python
def call_tool(tool_name: str, params: dict) -> dict:
    ...
```

On import, it reads `AIVARO_MCP_URL`. If set and the server responds to a health check, it configures the live client. Otherwise it sets `_stub = True` and logs one INFO message. All calls to `call_tool` when `_stub` is True return `{"status": "mcp_unavailable", "tool": tool_name}`.

The tool registry wires `mcp_client.call_tool` only for tools prefixed with `mcp:` in the crew file. Standard tools (`web_search`, `write_file`, etc.) are never routed through MCP unless the crew file explicitly uses the prefix.

---

## Audit DB schema

```sql
CREATE TABLE IF NOT EXISTS events (
    event_id    TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    agent_id    TEXT,
    payload     TEXT NOT NULL   -- JSON
);

CREATE INDEX IF NOT EXISTS idx_run ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_type ON events(event_type);
```

No UPDATE or DELETE is issued by the application after initial schema creation.

---

## Error handling

| Situation | Behaviour |
|---|---|
| Crew file not found | Exit 1, print path and suggestion to check the argument |
| Crew file fails validation | Exit 1, print the first validation error with the field path |
| Agent step raises unexpected exception | Log `action_failed` event; orchestrator skips agent; continues run |
| Executor hash mismatch | Abort current action; log `action_failed` with reason `hash_mismatch`; orchestrator continues |
| MCP server unreachable | Log INFO; degrade to stub; never raise |
| SQLite write fails | Log to stderr; re-raise (audit integrity is non-negotiable) |

---

## Dependencies

| Package | Purpose | Required |
|---|---|---|
| `click` | CLI parsing | Yes |
| `pyyaml` | Crew file parsing | Yes |
| `pydantic` | Model validation | Yes |
| `openai` | LLM calls (non-mock) | No (optional) |
| `httpx` | MCP health check and tool calls | No (optional) |
| `pytest` | Testing | Dev only |

The core (gateway, executor, audit, mock engine) has no network dependencies. `openai` and `httpx` are imported lazily and only when mock mode is off.
