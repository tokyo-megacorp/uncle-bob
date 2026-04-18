# Changelog

## Unreleased

### Added
- **Clean Architecture canon** — `hooks/precepts/_architecture.md` (distilled summary for LLM) + `hooks/precepts/principles/architecture.md` (verbose reference). Covers Dependency Rule, layered responsibilities (Entities / Use Cases / Interface Adapters / Frameworks & Drivers), Boundaries, Screaming Architecture, framework/database/UI Independence, Humble Object, Main Component, and Testability.
- **Opt-in plan review gate** — two new hooks review plans and specs against the Clean Architecture canon:
  - `PreToolUse ExitPlanMode` → `hooks/scripts/pretooluse-plan-review.mjs` — reviews the plan text before plan-mode exits; blocks on HARD violations.
  - `PostToolUse Write|Edit` (filtered to plan/spec paths) → `hooks/scripts/posttooluse-plan-review.mjs` — reviews the saved content; blocks with corrective-edit feedback.
- `hooks/scripts/lib/plan-review.mjs` — shared helpers (config gate, prompt build, `callClaude` transport, `parseReview` contract, `reportReviewOutcome` sink). Fails closed on broken install (missing prompt/precepts surface as an explicit `decision: "block"` with a diagnostic reason, not an uncaught exit 1).
- `hooks/prompts/plan-review-gate.md` — LLM-judge template with compact ALLOW / BLOCK first-line contract, Codex-pattern XML blocks (`<task>`, `<compact_output_contract>`, `<default_follow_through_policy>`, `<grounding_rules>`, `<action_safety>`, `<dig_deeper_nudge>`).
- `/uncle-bob:setup --enable-plan-review` / `--disable-plan-review` flags. `--status` now reports `plan_review`. Default is off — the gate is opt-in.

### Changed
- **Layout reorg** per `plugin-authoring/best-practices/organization.md`:
  - `hooks/*.mjs` → `hooks/scripts/*.mjs`
  - `hooks/lib/` → `hooks/scripts/lib/`
  - `precepts/` → `hooks/precepts/`
  - `prompts/` → `hooks/prompts/`
  - `hooks/hooks.json` command paths updated to `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.mjs`
  - `hooks/scripts/stop-uncle-bob.mjs` ROOT_DIR recomputed for new depth, with self-documenting comment (`hooks/scripts/ → hooks/ → plugin root`)
  - Behavior of existing hooks unchanged.

## 0.1.0 — 2026-04-18

Initial scaffold. Cell 8 best-of-breed hook stack.

### Added
- `.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/hooks/hooks.json` — 5-event hook registration (SessionStart, PostToolUse, UserPromptSubmit, Stop, PreCompact)
- `.claude-plugin/commands/setup.md` — `/uncle-bob:setup`
- `.claude-plugin/commands/review.md` — `/uncle-bob:review`
- `hooks/lib/regex-scanner.mjs` — Tier-1 auto-detectable smell scanner (LOC, arity, flag args, single-letter names, magic numbers)
- `hooks/sessionstart-snapshot.mjs` — pre-turn git baseline + tip-of-the-day
- `hooks/posttooluse-regex-scan.mjs` — per-Write/Edit Tier-1 scan → scratch
- `hooks/userpromptsubmit-grade-card.mjs` — scratch → additionalContext + clear (sentinel-idempotent)
- `hooks/stop-uncle-bob.mjs` — conditional Tier-2 LLM review via `claude --print`
- `hooks/precompact-summary.mjs` — preserve smell summary across compaction
- `prompts/stop-review-gate.md` — LLM review prompt template
- `precepts/_summary.md` — distilled canon (SOLID + naming + functions, ~400 lines)
- `precepts/principles/{solid,naming,functions}.md` — extended references
