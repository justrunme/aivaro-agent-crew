# Kiro usage evidence and model cost policy

## Verified on 2026-11-16
- `kiro-cli 3.3.0`, logged in via Builder ID `justrunme@gmail.com`.
- `kiro-cli chat --list-models` reports these credit multipliers: `auto` 1.00x; `claude-sonnet-4.5` 1.30x; `claude-haiku-4.5` 0.40x; `deepseek-3.2` 0.25x; `minimax-m2.5` 0.25x; `minimax-m2.1` 0.15x; `glm-5` 0.50x; `qwen3-coder-next` 0.05x.
- `kiro-cli profile` says the command is only available to Pro users. **Remaining credits and reset date have not been verified.** Multipliers are not remaining balance.
- Kiro CLI was used for initial specs and scaffold; a subsequent spec-reconciliation run timed out after partially updating tasks.md. Changes were reviewed and finished outside Kiro.
- A targeted `qwen3-coder-next` read-only review of `package.json` and `docs/SECURITY_REVIEW.md` finished successfully (exit 0) in approximately 13 seconds, reporting source verification as an issue. This demonstrates actual Kiro model execution, but not a verified credit balance.

## Cost discipline
- Routine focused code/docs tasks: try `--model qwen3-coder-next` (0.05x), verify results with tests and independent review.
- Architecture/security questions: use a stronger model only where cheaper model results are insufficient.
- Do not use open-ended autonomous prompts that repeatedly read the entire repository.
- Use bounded runs with explicit files, acceptance criteria and timeouts; record actual model and result.
- Do not equate Kiro model selection with implementing a real Kiro Crew app.

- 2026-11-16: Kiro CLI `qwen3-coder-next` read-only review of `README.md` and `demos/signed-read.js`. Proposed resolving symlinks before displaying the local approval prompt. Implemented and tested independently. Other Kiro observations about path traversal and replay were incorrect for the actual code; the replay store already persists consumed nonces. No code authored by this Kiro invocation.


- 2026-11-16: Real model inference: `node demos/kiro-incident.js --sample` spawned authenticated `kiro-cli chat --v2 --model qwen3-coder-next --no-interactive`, with bundled synthetic Kubernetes OOM incident. Completed successfully; generated diagnosis of OOMKilled exit 137, 251Mi/256Mi working set, cache increase, and human-gated remediation. Run ID `7748e0cd-308c-4521-aff0-acb02d05a827` recorded in local SQLite audit. No cluster or shell action executed. Kiro CLI also reviewed design; suggestion to use a nonexistent `kiro run` was rejected after consulting official CLI docs.

- 2026-11-16: Kiro CLI read-only architecture review proposed two genuine model invocations (triage and adversarial SRE reviewer), each audited. Implemented `demos/kiro-crew.js` and regression tests. Real `node demos/kiro-crew.js --sample` completed: run `cc51f710-b165-47b2-9dcf-95c03462531e`. First agent diagnosed memory pressure; second challenged certainty, flagged unsafe blind memory increase and recommended checking cache configuration and profiling. Both were genuine `kiro-cli chat` model calls. No cluster action executed.

- 2026-11-16: Kiro CLI design review for showing real model-backed audit runs in local Mission Control without enabling browser-triggered inference. UI now derives historical agent roster from persisted audit events, labels model inference separately from mock approvals, and displays bounded summaries. This is visualization only, not an execution or consent path.

- 2026-11-16: Kiro CLI architecture review of combining real two-agent incident analysis with deterministic non-executable remediation plan, one-time Ed25519 signing and replay/tamper proof. Implemented `demos/kiro-approval-proof.js` with interactive fail-closed human confirmation, no live tool execution, and four tests. Kiro review used read-only workspace access; no Kiro-generated code was accepted blindly.

- 2026-11-16: Kiro CLI read-only UX review of Mission Control showcase. Rebuilt the audit viewer with incident investigation flow, two-agent graph, model evidence timeline, audit statistics, and explicit signed-proof boundaries. The browser remains mock-trigger/read-only-history; genuine Kiro inference stays in CLI.
