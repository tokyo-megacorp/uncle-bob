# Changelog

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
