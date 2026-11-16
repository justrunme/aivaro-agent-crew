# Aivaro Unified Platform — Kiroween 2026

## Product correction
This is NOT a generic Kubernetes incident chatbot. Aivaro is an existing local-first MCP desktop gateway and Android approval companion. Agent Crew is a new orchestration layer. The contest experience must demonstrate the **real** desktop gateway, Trust Policy Engine, sandbox, browser/files/system tools, real Kiro multi-agent intelligence, phone Action Cards, signed decision, evidence receipts and Mission Control together. Do not present pre-existing Aivaro as hackathon-created code. Do not fake integration with simulated buttons.

## Source-of-truth repositories
- Existing gateway: `~/aivaro-work/aivaro` (macOS/Windows terminal, browser, desktop, system, Trust, relay, supervisor, workflow).
- Existing Android: `~/aivaro-work/agent-approval` (signed phone approval, pairing, biometric, freeze).
- Hackathon orchestration: `~/aivaro-work/aivaro-agent-crew` (Kiro CLI two-agent inference, local audit, Mission Control, signed plan demo).

## End-to-end must-haves (acceptance requires real tests)
1. **Kiro brain:** Kiro CLI is a real participant in execution, not only a planning reviewer. A planner and an independent skeptical reviewer with bounded context, safe structured proposals, model-call provenance, and an adversarial prompt-injection test.
2. **Real Aivaro MCP:** list capabilities from existing local MCP adapter; for tool calls use an explicit allowlist and route through Aivaro Trust. No fallback that silently calls a mock tool. Start read-only, then narrow approved mutation. No raw terminal bypass.
3. **Trust:** Aivaro's real permission engine classifies read/modify/sensitive, checks action digest and scope; deny-by-default, no alternate execution route.
4. **Android:** existing Android app is the decision signer through actual pairing protocol, not a local ephemeral key disguised as human consent. Validate signature, freshness, nonce, device identity and freeze state.
5. **Sandbox:** actual macOS Seatbelt for restricted terminal and an honest Windows capability matrix. Never claim a security boundary on unsupported OS.
6. **Tool diversity:** one coherent task spanning files, browser and terminal, with clear explicit authorization for any sensitive operation; no untrusted arbitrary shell text.
7. **Evidence:** append-only audit plus tamper-evident chain or signed receipts, provenance of Kiro prompts/model outputs, decision, execution result and policy.
8. **Mission Control:** truthful live state for a real run, agent graph, action preview, pending phone approval, deny/approve, verified receipt, freeze and audit. Browser must not mint human signatures.
9. **Replayable offline demo:** deterministic fixtures and recorded scenario clearly labeled, plus a real Kiro + real Aivaro + phone path separately proven.
10. **Contest:** 2–3 min uncut walkthrough, README setup, architectural threat model, Kiro feature usage evidence, originality and before/after measurable value.

## Non-negotiable
- Do not copy/paste entire Aivaro codebase into Agent Crew; integrate by versioned adapter/protocol.
- Never invent Android connectivity, browser automation, or successful OS sandbox.
- No arbitrary LLM-provided command execution.
- Explicit user approval for modifying files, external services, and deployments.
- CI on deterministic tests; integration test opt-in with real connected devices.
