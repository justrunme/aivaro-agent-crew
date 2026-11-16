# Engineering rules — Kiroween Agent Crew

- This is a NEW Node.js ESM project; do not rewrite it in Python or copy code from the older Aivaro / Android Agent Approval repositories.
- Read `.kiro/specs/agent-crew/tasks.md` and `docs/SECURITY_REVIEW.md` before editing.
- Do not claim live execution, phone consent, cryptographic audit integrity or Kiro Crew compatibility unless actually implemented and tested.
- Live MCP `tools/call` must remain disabled until trusted phone public-key enrollment, explicit signed user consent, replay protection, policy enforcement and OS sandboxing are end-to-end tested.
- Keep changes small, with regression tests. Run `npm test` and `git diff --check` before committing.
- Prefer narrow prompts and minimum required files; use inexpensive models for straightforward tasks and stronger models for security design reviews.
- Never claim a model's credit balance without checking an authoritative source.
- Do not expose private credentials, local configuration secrets or email addresses in logs.
