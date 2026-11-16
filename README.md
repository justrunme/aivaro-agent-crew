# 🎃 Kiroween 2026 — Aivaro Agent Crew

> **Hackathon entry for Kiroween 2026.**
> This project was planned, specified, and scaffolded using [Kiro CLI](https://kiro.dev).
> See `.kiro/` for specs and steering generated during development.

---

## What it is

**Aivaro Agent Crew** is a standalone, local-first multi-agent orchestration MVP.
It lets you define a small crew of AI agents that collaborate on a task — passing work between each other, requesting human approval before any consequential action, and producing a verifiable audit trail of everything they did.

The key design bets:

- **Safety over capability.** Every action an agent wants to take is hashed and must be explicitly approved before execution. The system is deny-by-default; agents cannot act unilaterally.
- **Local-first.** No cloud dependency to run or demo the system. All state lives in a local SQLite database. The network is optional.
- **Deterministic demo mode.** A `--mock` flag swaps all LLM and tool calls for a scripted replay so reviewers can run the full flow without API keys.
- **Optional Aivaro MCP integration.** When an [Aivaro MCP server](https://docs.aivaro.dev/mcp) is reachable, agents can call its tools through the standard MCP protocol. The system degrades gracefully when it is not.

---

## Motivation

Current multi-agent frameworks tend to either:
- Trust agents too much (autonomous loops with no human gate), or
- Be so locked to a cloud provider that local experimentation is painful.

This project explores a middle path: a lightweight orchestrator you can run from your laptop, inspect completely, and extend with real tools when you are ready — without ever losing the ability to audit or revert.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────┐
│                   CLI / REPL                        │
│  aivaro-crew run <crew-file> [--mock] [--dry-run]   │
└───────────────────┬─────────────────────────────────┘
                    │ parses crew definition (YAML)
                    ▼
┌─────────────────────────────────────────────────────┐
│               Orchestrator                          │
│  • maintains agent queue                            │
│  • routes messages between agents                   │
│  • emits ActionProposal events                      │
└──────┬──────────────────────────┬───────────────────┘
       │                          │
       ▼                          ▼
┌─────────────┐          ┌────────────────────┐
│  Agent Pool │          │  Approval Gateway  │
│  (workers)  │          │  hash + prompt     │
│             │          │  deny-by-default   │
│  LLM calls  │          │  CLI or MCP tool   │
│  tool calls │          └────────────────────┘
└──────┬──────┘                   │ approved actions only
       │                          ▼
       │                 ┌────────────────────┐
       └────────────────▶│   Action Executor  │
                         │   + Audit Log      │
                         │   (SQLite)         │
                         └────────────────────┘
                                  │ optional
                                  ▼
                         ┌────────────────────┐
                         │  Aivaro MCP Server │
                         │  (remote tools)    │
                         └────────────────────┘
```

---

## Safety model

| Property | Mechanism |
|---|---|
| Deny-by-default | No action executes without an approval record in the DB |
| Action binding | Approval is bound to a SHA-256 hash of the exact action payload; replaying a mutated action is rejected |
| Scope limits | Each agent declares its allowed tool list in the crew file; calls outside that list are blocked at the gateway |
| Audit trail | Every proposal, approval, rejection, and execution is written to `~/.aivaro-crew/audit.db` |
| No self-modification | Agents cannot read or write their own crew file, the audit DB, or the orchestrator config |
| Mock mode | `--mock` replaces all external I/O with deterministic fixtures; no credentials required |

---

## Quick start

> **Status: pre-alpha / hackathon prototype.**
> Nothing is wired to real infrastructure yet. Use `--mock` to run the demo.

```bash
# Clone and install (Python 3.11+)
git clone https://github.com/your-org/aivaro-agent-crew
cd aivaro-agent-crew
pip install -e ".[dev]"

# Run the demo crew in mock mode (no API keys needed)
aivaro-crew run examples/research-crew.yaml --mock

# Run with Aivaro MCP server (requires a running MCP endpoint)
export AIVARO_MCP_URL=http://localhost:4000
aivaro-crew run examples/research-crew.yaml
```

---

## Crew file format

```yaml
# examples/research-crew.yaml
name: Research Crew
goal: "Summarize the latest developments in formal verification of LLM outputs"

agents:
  - id: researcher
    role: Web Researcher
    tools: [web_search, fetch_url]
    model: gpt-4o-mini       # or "mock" to use fixtures

  - id: analyst
    role: Analyst
    tools: [read_file, write_file]
    model: gpt-4o-mini

  - id: writer
    role: Technical Writer
    tools: [write_file]
    model: gpt-4o-mini

approval:
  mode: cli          # "cli" | "mcp" | "auto-approve-safe"
  safe_actions: []   # nothing is auto-approved by default
```

---

## Project structure

```
aivaro-agent-crew/
├── README.md
├── LICENSE
├── .gitignore
├── .kiro/
│   ├── specs/agent-crew/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   └── steering/
│       └── product.md
├── pyproject.toml          # (not yet created — see tasks.md)
├── src/
│   └── aivaro_crew/
│       ├── orchestrator.py
│       ├── agent.py
│       ├── gateway.py      # approval gateway
│       ├── executor.py
│       ├── audit.py
│       ├── mcp_client.py   # optional Aivaro MCP adapter
│       └── mock/
│           └── fixtures.py
├── examples/
│   └── research-crew.yaml
└── tests/
```

---

## Kiro CLI usage transparency

This project was built as a Kiroween 2026 entry.
The `.kiro/` directory contains the full requirements, design, and task specs generated with Kiro CLI.
All significant design decisions are traceable to those specs.

No code was copied from existing Aivaro repositories.
All implementation is original to this hackathon project.

---

## Disclaimer

This is a hackathon prototype, not a production system.
Do not connect it to production infrastructure, credentials, or sensitive data.
The safety mechanisms described above are designed to be auditable and educational,
not to substitute for a security review.

---

## License

MIT — see `LICENSE`.

## Local mission-control demo (mock only)

```sh
npm test
npm run dashboard
```

Open `http://127.0.0.1:4317` on the same Mac and select **Run safe demo**. The UI displays three scripted agents, simulated approvals and an audit timeline. No real MCP tools are invoked. Security findings and limitations: [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).
