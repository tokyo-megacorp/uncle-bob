# Changelog

## [0.3.0] — 2026-04-20 — grade command + semantic Tier-2

### Added
- `/uncle-bob:grade` — static audit analytics (pass rate, skip rate, avg elapsed, recent fails). Scoped to current project by `cwd`; `--all` for global aggregate.
- `~/.uncle-bob/smell-ledger.jsonl` — persistent Tier-1 smell history. UserPromptSubmit now appends findings before clearing scratch, enabling per-principle breakdown in `/grade`.

### Fixed
- `fix(grade)`: default scope by `cwd` — multi-project users no longer get mixed-session stats.
- `fix(stop-hook)`: `readTier1Findings` moved before `appendAudit` — ReferenceError on startup.

### Changed
- **Tier-2 redesign (B+C):** Stop hook always runs when diff > threshold. Prompt rewritten to focus exclusively on semantic/architectural violations (SRP, OCP, LSP, ISP, DIP, CQS). When Tier-1 found smells, they are injected as `<tier1_already_caught>` context so LLM never re-flags what regex already caught. Worst-quality turns no longer escape semantic review.
- Removed dead `tier1HasHits()` — Tier-2 is now fully independent of Tier-1 results.
- Audit `started` entries now include `tier1_hits` count for observability.

## [0.2.1] — 2026-04-20 — env-var override + stop-hook burst fix

### Added
- `env var override` for uncle-bob config + balanced-tag git hook + perf benchmark

### Fixed
- `fix(stop-hook)`: diff gate + cooldown prevent per-turn burst freezing CC
- `fix(stop-hook)`: MS_PER_SECOND constant + rename `e` → `entry` in grade-card
- `fix(hooks)`: precompact hook output uses `systemMessage` not `hookSpecificOutput`

### Changed
- `refactor(stop-hook)`: extract `findLastCompletedEntry` — reduce nesting depth

## [0.2.0] — 2026-04-19 — Clean Architecture gate + 62s→5s stop-hook

### Added
- **Clean Architecture canon** — `hooks/precepts/_architecture.md` (distilled summary for LLM) + `hooks/precepts/principles/architecture.md` (verbose reference). Covers Dependency Rule, layered responsibilities (Entities / Use Cases / Interface Adapters / Frameworks & Drivers), Boundaries, Screaming Architecture, framework/database/UI Independence, Humble Object, Main Component, and Testability.
- **Opt-in plan review gate** — two new hooks review plans and specs against the Clean Architecture canon:
  - `PreToolUse ExitPlanMode` → `hooks/scripts/pretooluse-plan-review.mjs` — reviews the plan text before plan-mode exits; blocks on HARD violations.
  - `PostToolUse Write|Edit` (filtered to plan/spec paths) → `hooks/scripts/posttooluse-plan-review.mjs` — reviews the saved content; blocks with corrective-edit feedback.
- `hooks/scripts/lib/plan-review.mjs` — shared helpers (config gate, prompt build, `callClaude` transport, `parseReview` contract, `reportReviewOutcome` sink). Fails closed on broken install (missing prompt/precepts surface as an explicit `decision: "block"` with a diagnostic reason, not an uncaught exit 1).
- `hooks/prompts/plan-review-gate.md` — LLM-judge template with compact ALLOW / BLOCK first-line contract, Codex-pattern XML blocks.
- `/uncle-bob:setup --enable-plan-review` / `--disable-plan-review` flags. `--status` now reports `plan_review`. Default is off — the gate is opt-in.
- **Review spawn tuning knobs** — two new config keys controlling how both review tiers (Stop gate + plan review) invoke `claude`:
  - `model` — `auto` | `opus` | `sonnet` | `haiku`. Default `auto` (no `--model` flag). Invalid values treated as `auto`.
  - `bare` — `on` | `off`. Default `off`. When `on`, review spawns use `claude --bare` so the sub-claude skips plugin sync, CLAUDE.md auto-discovery, keychain, auto-memory, and background prefetches. Trade-off: auth becomes strictly `ANTHROPIC_API_KEY` (OAuth/keychain ignored) — intended for routing review cost to an API key instead of the Max subscription.
- **Sub-claude isolation flags** — every review call now always passes `--plugin-dir <empty>`, `--strict-mcp-config --mcp-config '{"mcpServers":{}}'`, `--disable-slash-commands`, `--no-session-persistence`, `--tools ""`, and `--remote-control-session-name-prefix uncle-bob-review`. **Measured cold-start drops from 62s to 4.67s on haiku** by keeping the sub-claude from inheriting the user's plugins, MCPs, and skills.
- `/uncle-bob:setup --model <auto|opus|sonnet|haiku>` and `--bare <on|off>` actions, plus both values in `--status` output.
- `buildClaudeArgs(config)` exported from `hooks/scripts/lib/plan-review.mjs` — pure helper shared by Stop and plan-review spawns so argv assembly lives in one place.
- **Stop hook observability** — sub-Claude stderr is streamed in real time to `~/.uncle-bob/sessions/<session_id>/stop-review.stderr.log` (tailable with `tail -f`); audit entries now carry a `phase` field (`started` / `completed` / `skipped`) and `completed` entries include `elapsed_ms` for timing diagnosis.

### Fixed
- **Review sub-claude responding in non-English and breaking parser** — switched `--append-system-prompt` → `--system-prompt` so the sub-claude no longer loads the user's CLAUDE.md (which forced Portuguese replies and produced "malformed output" errors). The canon precepts now become the full system prompt for review spawns.
- **MAGIC_NUMBER scanner false positives** — hyphenated identifiers (`gpt-5`, `sha-256`, `claude-4-7`) and numbers inside string literals are no longer flagged. Covers the overwhelming majority of model/version/codec names without needing a hardcoded whitelist.

### Changed
- **Layout reorg** per `plugin-authoring/best-practices/organization.md`:
  - `hooks/*.mjs` → `hooks/scripts/*.mjs`
  - `hooks/lib/` → `hooks/scripts/lib/`
  - `precepts/` → `hooks/precepts/`
  - `prompts/` → `hooks/prompts/`
  - `hooks/hooks.json` command paths updated to `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.mjs`
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
