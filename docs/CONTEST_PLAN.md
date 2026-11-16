# Kiroween 2026 — evidence-led submission plan

**Deadline:** 2026-12-04 22:00 UTC. **Target:** Frankenstein (standalone agent orchestration + human authorization + auditable local runtime). Official rules: https://kiroween.devpost.com/rules

## Must demonstrate (not just describe)

- Real, reproducible end-to-end user problem and outcome, not only mock crew animations.
- A working local demo and a <3 minute public YouTube walkthrough.
- Genuine Kiro-driven implementation with `.kiro/` specs, steering, hooks/agents as actually used; evidence and honest attribution.
- Public GitHub source with MIT license, installation instructions, and disclosure of pre-existing Aivaro/Android work.
- A clear distinction between local ephemeral signatures and trusted external phone approval; no claim of a production sandbox.

## Competitive differentiation

A multi-agent dashboard alone is common. The defensible idea is a **human-authorized execution boundary** with exact action hash, Ed25519 verification, replay protection, and a clear deny/recovery narrative. Build a 90-second before/after story: an agent proposes a risky action, the user sees the precise impact, DENY prevents execution, APPROVE authorizes only that exact action, tampering/replay fails, receipt is inspectable.

## Current gaps (do not overclaim)

- The three-agent crew is scripted; a separate real Kiro-powered single-agent incident triage is implemented and tested.
- No enrolled Android Keystore identity or device-signed transport yet.
- No OS-level sandbox; read_file realpath check is subject to filesystem races.
- No full end-to-end approval/receipt visualization in Mission Control.
- No public contest video or hosted judge demo.

## External competitive visibility

The official 2026 project gallery is not yet published as of 2026-11-16; no reliable named competitor leaderboard exists. Do not infer entrants from the 2025 gallery. Competition has >14k registered participants, not necessarily 14k submissions.
