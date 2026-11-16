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
