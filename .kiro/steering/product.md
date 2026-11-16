# Product Steering — Aivaro Agent Crew

> This file steers Kiro CLI's understanding of what this project is, what it must never do,
> and how design decisions should be prioritised throughout the build.

---

## What we are building

A local-first, multi-agent orchestration prototype for the Kiroween 2026 hackathon.
Target audience: developers who want to experiment with supervised multi-agent collaboration
without cloud lock-in, without API keys for demos, and without giving agents unchecked autonomy.

**Success for the hackathon means:** a reviewer can clone the repo, run `aivaro-crew run examples/research-crew.yaml --mock`, and observe a full multi-agent loop — with human approval prompts, an audit trail written to SQLite, and a clean CLI output — without touching a credential.

---

## Non-negotiable constraints

1. **No unsafe autonomous execution.** An agent action never runs unless a human (or an explicitly configured auto-approve rule scoped to a named safe-action list) has approved it in the current session.
2. **No code copied from existing Aivaro repositories.** Every implementation file in `src/` is original to this hackathon entry.
3. **No production claims.** README, docs, and comments must clearly state pre-alpha / hackathon prototype status.
4. **Mock mode must be fully deterministic.** The same crew file + `--mock` must produce byte-identical output on every run (modulo timestamps in log lines, which are injected via a seeded clock).
5. **Approval binding is cryptographic.** An approval token is only valid for the SHA-256 hash of the exact action payload it was issued for. Any mutation of the payload invalidates the token.

---

## Design priorities (in order)

1. **Safety** — human gate before every consequential action; deny-by-default everywhere.
2. **Auditability** — every event (proposal, approval, rejection, execution, error) written to SQLite with a timestamp and content hash.
3. **Runnability** — the demo must work offline and without credentials via `--mock`.
4. **Simplicity** — prefer fewer abstractions. The orchestrator, gateway, and executor must each be understandable as a single module.
5. **Extensibility** — MCP integration is optional; removing it should require deleting one file, not refactoring the core.

---

## Scope limits (18-day window)

**In scope:**
- CLI entrypoint (`aivaro-crew run`)
- YAML crew file parsing and validation
- Orchestrator (sequential task routing between agents)
- Approval gateway (hash + CLI prompt)
- Action executor (runs approved tool calls)
- Audit log (SQLite, `~/.aivaro-crew/audit.db`)
- Mock/fixture engine (`--mock`)
- Optional Aivaro MCP adapter (graceful no-op when server is absent)
- One working example crew (`examples/research-crew.yaml`)
- Unit tests for gateway hash logic and mock engine

**Out of scope for this entry:**
- Parallel agent execution
- Web UI or dashboard
- Persistent agent memory across sessions
- Authentication or multi-user support
- Production hardening, rate limiting, or cost controls
- Any cloud deployment

---

## Aivaro MCP integration guidance

The MCP adapter (`src/aivaro_crew/mcp_client.py`) must:
- Detect the MCP server via the `AIVARO_MCP_URL` environment variable.
- Fall back silently to a stub that returns `{"status": "mcp_unavailable"}` when the variable is unset or the server is unreachable.
- Never block startup or the mock demo path.
- Log a single INFO line when it falls back, not a stack trace.

---

## Tone and naming

- Use `aivaro-crew` as the CLI command name.
- Use `Aivaro Agent Crew` as the project display name.
- Refer to the approval step as the "Approval Gateway", not "human-in-the-loop" or "HITL".
- Keep all user-facing output terse. Progress lines ≤ 80 characters. Errors describe what happened and what the user can do next.
