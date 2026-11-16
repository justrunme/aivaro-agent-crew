# Unified architecture and migration

```text
Kiro CLI (planner → skeptical reviewer → typed intent)
    ↓ (untrusted model output; validate and constrain)
Agent Crew orchestrator / scoped action planner
    ↓ (signed action intent, policy metadata)
Aivaro MCP adapter → Aivaro Trust/Policy Engine → phone Action Card
                         ↓ signed device decision / freeze / nonce
              Aivaro Seatbelt / browser / files / system executors
                         ↓ result + provenance
          Aivaro Trust evidence → Agent Crew audit → Mission Control
```

## Existing components vs hackathon novelty
| Component | Exists in gateway/phone | Agent Crew status | Gap |
|---|---|---|---|
| Terminal MCP + sandbox | Existing macOS Seatbelt | discovery only | versioned safe tool bridge |
| Browser automation | Existing Aivaro | not connected | constrained browser task |
| Files/system/desktop | Existing Aivaro | live read_file gate only | real Aivaro MCP adapter |
| Permission Engine/Action Cards | Existing Aivaro | local simulated approval | delegate to Trust |
| Android signed approvals | Existing Android | NOT connected | real pairing/decision bridge |
| Relay/remote | Existing prototypes | NOT connected | prove transport, freeze |
| Kiro model-backed agents | New, 2 real calls | yes (synthetic incident) | structured intent + actual work |
| Audit and Mission Control | New local SQLite UI | partial | verifiable end-to-end receipts |

## First vertical slice (do this before polish)
Real Kiro asks to inspect a synthetic repository regression → Aivaro MCP reads an allowlisted file under explicit root → reviewer verifies evidence → proposed edit is blocked by Trust until Android signs → Aivaro executes only predeclared bounded edit in sandbox → signed/audited receipt displayed. Fail closed if phone/Trust/sandbox unavailable; offer a clearly labeled offline simulation.

## Phases
P0 inventory actual protocol and policy paths, determine compatibility, record proof.
P1 real read-only Kiro → Aivaro MCP tool call with allowlist and evidence.
P2 Trust policy + Android signed decision, denial and freeze, without mutation.
P3 single safe bounded edit through sandbox with rollback and receipt.
P4 UI live state, attack demonstrations, video, submission.
