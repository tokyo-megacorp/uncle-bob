# Design notes — why the Cell 8 hook stack

## The decision

uncle-bob's hook architecture wasn't intuition. It came out of a 3×3 idea-matrix that scored 9 candidate stacks across four dimensions: feasibility, risk, synergy potential, implementation cost. The options under evaluation were:

- **A** — Stop hook only (post-turn `claude --print` review-gate, reactive)
- **B** — PreToolUse `Agent` matcher only (inject canon into spawned subagents, preventive via mutation)
- **C** — PreToolUse `Edit|Write` matcher only (regex intercept at write-time, proactive)
- **D** — PostToolUse `Edit|Write` matcher only (observational audit log, no blocking)

## The matrix

| # | Cell | Feas | Risk⁻¹ | Synergy | Cost⁻¹ | Composite | Dealbreaker |
|---|---|---|---|---|---|---|---|
| 4 | D solo — PostToolUse audit | 5 | 5 | 4 | 5 | **4.75** | — |
| **8** | **Best-of-breed remix** | **5** | **5** | **5** | **4** | **4.75** | **—** |
| 9 | Contrarian — skill-only | 5 | 5 | 4 | 5 | **4.75** | audience-conditional |
| 6 | A+C — Stop + write-time | 4 | 4 | 5 | 3 | 4.00 | — |
| 1 | A solo — Stop only | 4 | 3 | 4 | 4 | 3.75 | — |
| 3 | C solo — Edit/Write only | 4 | 3 | 4 | 4 | 3.75 | — |
| 2 | B solo — Agent only | 3 | 3 | 4 | 3 | 3.25 | — |
| 5 | A+B — Stop + Agent | 3 | 4 | 4 | 2 | 3.25 | **YES** |
| 7 | A+B+C — full stack | 3 | 4 | 4 | 2 | 3.25 | **YES** |

Three-way tie at 4.75. Cell 4 is a strict subset of Cell 8 (observational only). Cell 9 has an audience-conditional dealbreaker (skill-only loses the enforcement guarantee this plugin exists to provide).

**Winner: Cell 8 — best-of-breed remix.**

## What Cell 8 proposes

Pick the best mechanism per tier of violation:

```
PostToolUse(Write|Edit)  → regex scanner → per-session scratch file
UserPromptSubmit          → inject scratch as "grade-card" → clear after inject
Stop                      → claude --print   (conditional: Tier-1 clean AND diff > 30)
SessionStart              → snapshot baseline.sha + tip-of-the-day
PreCompact                → preserve smell summary across compaction windows
```

Each event does one thing well. The LLM (expensive) runs at most once per turn, and only when cheap regex has nothing to say. The grade-card ships feedback at the only intervention point that actually changes Claude's output (the next prompt's context window).

## Top insights from the matrix

Insights the haiku agents surfaced that a first-read of the problem misses:

1. **UserPromptSubmit as grade-card delivery is the underrated channel.** It piggybacks on the turn the user is already paying for, costs zero extra LLM calls, and places smell feedback exactly where Claude is focused — right before the next response gets generated. This makes the feedback loop feel synchronous without blocking any tool.

2. **Edit hooks see only the delta hunk, not the full file.** Arity and LOC checks are blind without a pre-hook Read syscall on the target path — which would add latency and a syscall on every single edit. Write gets full content; Edit gets a fragment. A C-only strategy that treats both identically has high false-negative rates for Edit. Mitigation: **block-only on Edit, mutate on Write only** (what this plugin does).

3. **Ghost approval risk in any A+C-style combo.** If regex mutates code at write-time, then Stop's LLM reviews the partially-fixed diff at turn-end, the Stop gate is reviewing a file that no longer matches the original intent. It may under-flag. Mitigation: **Stop must diff against the pre-turn snapshot captured at SessionStart** — not the working tree. This plugin does exactly that via `~/.uncle-bob/sessions/<session_id>/baseline.sha`.

4. **PostToolUse can compute delta-metrics** — "did arity go UP or DOWN this edit?" — which is a far stronger signal than absolute LOC counts and is unavailable to any pre-tool approach (since pre-tool hooks see only the intended write, not the prior state). A future version can use this for regression detection.

5. **Stop fires once per turn regardless of write count.** Paradoxically cheaper than per-write LLM at scale, but token cost can spike on heavy refactor turns where the diff is huge. Guard: **diff-size floor of 30 lines** + Tier-1-clean gate.

6. **Hooks don't teach the model.** Each session starts fresh — a Stop hook firing doesn't persist any lesson into Claude's future sessions. The only intervention point that changes output is **context injection at generation time** (the UserPromptSubmit channel). Enforcement without pedagogy trains the user to dismiss warnings, not the model to avoid them. Cell 8 fuses both: Stop enforces, UserPromptSubmit teaches.

## Rejected designs and why

- **Cell 5 (A+B, Stop + Agent inject):** category error. Stop fires on the **parent** turn-end, not subagent completion. SubagentStop is the only hook that observes subagent completion, and it cannot block. So the "cure at turn-end" leg doesn't cover subagent output at all — the combo promises full coverage but has a structural blind spot for subagent-produced artifacts.

- **Cell 7 (A+B+C, full stack):** false-positive amplification. Three enforcement layers catch the same smell at different authority levels (regex vs LLM), surfacing the same complaint twice per turn. More layers = lower per-layer credibility. Accumulated latency also risks breaching the <100ms hook-budget guideline on hot paths.

- **Cell 9 (skill-only, no hooks):** strong epistemic argument (hooks train users to click past warnings; only context injection changes model output), but loses the enforcement guarantee uncle-bob is built to provide. The critique is absorbed by Cell 8's UserPromptSubmit grade-card channel, which **is** context injection at generation time — Cell 8 does what Cell 9 says should be done, and also enforces.

## Required mitigations applied in this plugin

- Pre-turn snapshot at SessionStart (resolves ghost approval)
- Sentinel `<!-- uncle-bob-grade-card -->` + clear logic on UserPromptSubmit (idempotent)
- BLOCK-only on PreToolUse Edit (no mutation — reserved for Write in a future version)
- Diff-size threshold guard on Stop's `claude --print` invocation

## Devil's advocate challenge (preserved from the matrix run)

> Cell 9 (contrarian) makes a strong epistemic argument: hooks train Pedro to click past warnings, not Claude to write cleaner code. Each session starts fresh — hooks have no learning effect on the model. Only context injection at generation time actually changes output.

**Absorbed mitigation:** Cell 8's UserPromptSubmit grade-card delivery IS context injection at generation time (the only intervention point Cell 9 says actually works). Cell 8 fuses enforcement (Stop) with pedagogy (UserPromptSubmit injection) in the same architecture.

## Recommended future improvements

- Track grade-card dismissal rate via signal telemetry. If the user ignores 3+ consecutive grade-cards, lower Tier-1 sensitivity (Cell 9's anti-friction principle).
- PreCompact regex summary already preserves smell history through compaction — extend to a post-compact recap so the compressed session retains the audit pattern.
- Per-project principle subset overrides via `.uncle-bob.yaml` at repo root (v2).
