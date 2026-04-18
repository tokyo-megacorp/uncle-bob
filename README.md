# uncle-bob

A Claude Code plugin that distills Robert C. Martin's canon (SOLID, naming, functions) and uses a layered hook stack to enforce it per turn.

## What it does

Every turn, the plugin runs a two-tier review of code changes:

- **Tier 1 (regex, free)** — on every `Write` / `Edit`, a PostToolUse hook scans for auto-detectable smells (functions over 20 lines, arity ≥ 4, flag boolean args, magic numbers, single-letter names). Hits land in a per-session scratch file.
- **Tier 2 (LLM, conditional)** — on `Stop`, if Tier-1 found nothing AND the turn's diff exceeds 30 lines, the hook spawns `claude --print` against the distilled canon to catch semantic violations (SRP, OCP, intent-reveal).

Before the next user turn, a grade-card is injected via `UserPromptSubmit` — feedback lands exactly where Claude is about to write its next response, for zero extra LLM cost.

## Architecture

```
SessionStart  → snapshot pre-turn baseline.sha + tip-of-the-day
PostToolUse   → regex scan Write|Edit → scratch file
UserPromptSubmit → inject scratch as grade-card → clear
Stop          → claude --print (ONLY if Tier-1 clean AND diff > 30 lines)
PreCompact    → preserve smell summary across compaction
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
         "installPath": "/Users/<you>/.claude/plugins/cache/uncle-bob-local/uncle-bob/0.1.0",
         "version": "0.1.0"
       }]
     }
   }
   ```
5. Symlink the cache so `/reload-plugins` picks up live edits:
   ```
   mkdir -p ~/.claude/plugins/cache/uncle-bob-local/uncle-bob
   ln -s /absolute/path/to/uncle-bob ~/.claude/plugins/cache/uncle-bob-local/uncle-bob/0.1.0
   ```
6. Run `/reload-plugins` in Claude Code. Then restart the session — hooks are snapshotted at startup and won't engage until the next fresh session.

If any of the four state files above is stale or missing, `/reload-plugins` silently skips the plugin.

### From marketplace (not published yet)
Pending publication — for now, the local-clone path above is the only route.

## Configure

```
/uncle-bob:setup --status    # current config
/uncle-bob:setup --disable   # silence all hooks for this install
/uncle-bob:setup --enable    # re-enable
```

Config lives at `~/.uncle-bob/config.json`. Shared across projects.

## On-demand review

```
/uncle-bob:review            # review staged diff
/uncle-bob:review <path>     # review specific file
/uncle-bob:review --since HEAD~5
```

Runs the same two-tier flow. Never blocks. Returns `PASS` or `FAIL` with per-principle hits.

## Canon coverage (v1)

- **SOLID**: SRP · OCP · LSP · ISP · DIP
- **Naming**: intention-revealing · searchable · pronounceable · one-word-per-concept
- **Functions**: small (≤20 LOC) · do one thing · ≤3 args · no flag args · no side effects · CQS

See `hooks/precepts/principles/` for extended references. `hooks/precepts/_summary.md` is the LLM-injected distilled canon.

## Audit log

`~/.uncle-bob/audit.jsonl` — one line per Stop-hook invocation with verdict, reason, session_id, and cwd. Powers future `/uncle-bob:grade`.

## Design notes

Why this stack? See [`docs/design-notes.md`](docs/design-notes.md) for the full reasoning (matrix ranking, rejected alternatives, required mitigations). The short version:

- **Don't double-punish**: if Tier-1 already caught smells, Tier-2 stays quiet. One complaint per turn.
- **Ghost approval mitigation**: Stop diffs against the SessionStart snapshot, not the working tree (otherwise regex-mutated code would look clean to LLM).
- **Grade-card delivery via UserPromptSubmit** is the underrated trick — piggybacks on the turn the user is already paying for, costs zero extra LLM calls, places feedback at the only intervention point that actually changes Claude's output.
- **Edit never mutated, only scanned**: Edit's payload is a hunk, not a full file; safe mutation requires pre-hook Read. Block-only reserved for Write mutations in a future version.

## License

MIT
