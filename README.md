# uncle-bob

A Claude Code plugin that distills Robert C. Martin's canon — Clean Code (SOLID, naming, functions) plus opt-in Clean Architecture — and uses a layered hook stack to enforce it per turn.

## What it does

Every turn, the plugin runs a two-tier review of code changes:

- **Tier 1 (regex, free)** — on every `Write` / `Edit`, a PostToolUse hook scans for auto-detectable smells (functions over 20 lines, arity ≥ 4, flag boolean args, magic numbers, single-letter names). Hits land in a per-session scratch file.
- **Tier 2 (LLM, conditional)** — on `Stop`, if Tier-1 found nothing AND the turn's diff exceeds 30 lines, the hook spawns `claude --print` against the distilled canon to catch semantic violations (SRP, OCP, intent-reveal).

Before the next user turn, a grade-card is injected via `UserPromptSubmit` — feedback lands exactly where Claude is about to write its next response, for zero extra LLM cost.

## Architecture

```
SessionStart     → snapshot pre-turn baseline.sha + tip-of-the-day
PostToolUse      → regex scan Write|Edit → scratch file
UserPromptSubmit → inject scratch as grade-card → clear
Stop             → claude --print (ONLY if Tier-1 clean AND diff > 30 lines)
PreCompact       → preserve smell summary across compaction
```

Optional (opt-in) Clean Architecture gate:

```
PreToolUse ExitPlanMode       → review the plan text before plan-mode exits
PostToolUse Write|Edit (plan/spec paths only) → review the written doc
```

## Prerequisites

- `claude` CLI on PATH (used by Stop hook's Tier-2 review)
- Node 18+ (hooks are ESM .mjs)
- `git` (for turn-diff baseline)

## Install

### As a directory-source plugin (local clone)

1. Clone the repo:
   ```
   git clone https://github.com/tokyo-megacorp/uncle-bob ~/path/to/uncle-bob
   ```
2. Register it as a local marketplace in `~/.claude/settings.json`:
   ```json
   {
     "extraKnownMarketplaces": {
       "uncle-bob-local": {
         "source": { "source": "directory", "path": "/absolute/path/to/uncle-bob" }
       }
     },
     "enabledPlugins": {
       "uncle-bob@uncle-bob-local": true
     }
   }
   ```
3. Mirror the same marketplace entry in `~/.claude/plugins/known_marketplaces.json` (required — `/reload-plugins` reads this file at resolve time, not `settings.json`):
   ```json
   {
     "uncle-bob-local": {
       "source": { "source": "directory", "path": "/absolute/path/to/uncle-bob" },
       "installLocation": "/absolute/path/to/uncle-bob"
     }
   }
   ```
4. Add the plugin to `~/.claude/plugins/installed_plugins.json` under `plugins`:
   ```json
   {
     "plugins": {
       "uncle-bob@uncle-bob-local": [{
         "scope": "user",
         "installPath": "/Users/<you>/.claude/plugins/cache/uncle-bob-local/uncle-bob/0.2.1",
         "version": "0.2.1"
       }]
     }
   }
   ```
5. Symlink the cache so `/reload-plugins` picks up live edits:
   ```
   mkdir -p ~/.claude/plugins/cache/uncle-bob-local/uncle-bob
   ln -s /absolute/path/to/uncle-bob ~/.claude/plugins/cache/uncle-bob-local/uncle-bob/0.2.1
   ```
6. Run `/reload-plugins` in Claude Code. Then restart the session — hooks are snapshotted at startup and won't engage until the next fresh session.

If any of the four state files above is stale or missing, `/reload-plugins` silently skips the plugin.

### From GitHub Releases

Download the latest release archive from [Releases](https://github.com/tokyo-megacorp/uncle-bob/releases) and follow the same steps above, pointing `path` and `installPath` to the extracted directory.

## Configure

```
/uncle-bob:setup --status                # current config
/uncle-bob:setup --disable               # silence the code-review stack
/uncle-bob:setup --enable                # re-enable
/uncle-bob:setup --enable-plan-review    # turn on the Clean Architecture gate
/uncle-bob:setup --disable-plan-review   # turn it off (default)
/uncle-bob:setup --model sonnet          # auto | opus | sonnet | haiku (default: auto)
/uncle-bob:setup --bare on               # on | off (default: off)
```

Config lives at `~/.uncle-bob/config.json`. Shared across projects. `--disable` is a master kill switch — it silences every hook including plan review. `--enable-plan-review` only has effect while the plugin is also enabled.

**Review spawn tuning**:
- `--model <auto|opus|sonnet|haiku>` picks which model the review sub-claude uses. `auto` passes no `--model` flag (CLI default applies).
- `--bare <on|off>` toggles `claude --bare` for review spawns. When `on`, the sub-claude skips plugin sync, CLAUDE.md auto-discovery, keychain, auto-memory, and background prefetches — faster, avoids hook-recursion, and guarantees Remote Control stays off. Trade-off: auth becomes strictly `ANTHROPIC_API_KEY` (OAuth/keychain ignored), so the cost routes to that key instead of your Max subscription. Default `off` to stay on OAuth.
- Review spawns always pass `--print`, `--no-session-persistence`, `--tools ""`, and `--remote-control-session-name-prefix uncle-bob-review` as invariants.

## On-demand review

```
/uncle-bob:review            # review staged diff
/uncle-bob:review <path>     # review specific file
/uncle-bob:review --since HEAD~5
```

Runs the same two-tier flow. Never blocks. Returns `PASS` or `FAIL` with per-principle hits.

## Canon coverage

### Clean Code (v1 — always on when enabled)

- **SOLID**: SRP · OCP · LSP · ISP · DIP
- **Naming**: intention-revealing · searchable · pronounceable · one-word-per-concept
- **Functions**: small (≤20 LOC) · do one thing · ≤3 args · no flag args · no side effects · CQS

Loaded into the Stop-gate LLM via `hooks/precepts/_summary.md`. Extended references in `hooks/precepts/principles/solid.md`, `naming.md`, `functions.md`.

### Clean Architecture (v1 — opt-in via `--enable-plan-review`)

- **Dependency Rule** · layered responsibilities (Entities · Use Cases · Interface Adapters · Frameworks & Drivers)
- **Boundaries** (Ports & Adapters) · Screaming Architecture
- **Independence** (framework · database · UI)
- **Humble Object** · Main Component · Testability as a structural property

Loaded into the plan-review LLM via `hooks/precepts/_architecture.md`. Extended reference in `hooks/precepts/principles/architecture.md`.

## Opt-in: Clean Architecture plan review

When enabled via `/uncle-bob:setup --enable-plan-review`, two hooks gate architectural decisions:

- **`PreToolUse ExitPlanMode`** — before the agent exits plan mode, the hook reads `tool_input.plan`, runs a Clean Architecture review, and blocks the exit if the plan has a Dependency Rule breach or a missing boundary at a critical seam. The agent receives the violation + a concrete structural fix.
- **`PostToolUse Write|Edit`** — when the agent writes or edits a plan/spec file, the hook reads the saved content and runs the same review. A path qualifies when it lives under a `plans/` or `specs/` directory, ends in one of `-plan.md` / `_plan.md` / `.plan.md` / `-spec.md` / `_spec.md` / `.spec.md`, or is exactly named `PLAN.md` or `SPEC.md`. The file isn't reverted on block — the reason surfaces to the agent so it follows up with a corrective edit.

Posture: prefer ALLOW. Block only on HARD-severity violations (the gate is meant to catch structural errors, not stylistic layering preferences). Verdicts are audited to `~/.uncle-bob/audit.jsonl` alongside the code-review gate.

## Audit log

`~/.uncle-bob/audit.jsonl` — one JSONL line per Stop-hook invocation. Each entry includes a `phase` field:

- `skipped` — gate short-circuited before spawning the sub-Claude (tier-1 hit or diff below threshold).
- `started` — sub-Claude is about to be spawned; includes `diff_lines`, `model`, and `bare`.
- `completed` — sub-Claude finished; includes `elapsed_ms`, `ok`, `reason`, and `cwd`.

## Observability

Sub-Claude stderr is streamed in real time to `~/.uncle-bob/sessions/<session_id>/stop-review.stderr.log`. Use `tail -f` on that file while a review is running to see plugin-sync noise, auth errors, or any diagnostic output from the sub-process. The log is appended (not truncated) across review runs within the same session.

Powers future `/uncle-bob:grade`.

## Design notes

Why this stack? See [`docs/design-notes.md`](docs/design-notes.md) for the full reasoning (matrix ranking, rejected alternatives, required mitigations). The short version:

- **Don't double-punish**: if Tier-1 already caught smells, Tier-2 stays quiet. One complaint per turn.
- **Ghost approval mitigation**: Stop diffs against the SessionStart snapshot, not the working tree (otherwise regex-mutated code would look clean to LLM).
- **Grade-card delivery via UserPromptSubmit** is the underrated trick — piggybacks on the turn the user is already paying for, costs zero extra LLM calls, places feedback at the only intervention point that actually changes Claude's output.
- **Edit never mutated, only scanned**: Edit's payload is a hunk, not a full file; safe mutation requires pre-hook Read. Block-only reserved for Write mutations in a future version.

## License

MIT
