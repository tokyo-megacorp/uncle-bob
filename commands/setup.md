---
description: Configure the uncle-bob plugin — toggle the Stop gate, the opt-in plan review, pick a review model, or check status.
argument-hint: "[--enable | --disable | --enable-plan-review | --disable-plan-review | --model <auto|opus|sonnet|haiku> | --bare <on|off> | --status]"
allowed-tools: Bash(mkdir:*), Bash(test:*), Read, Write, Edit
---

Configure the uncle-bob plugin based on `$ARGUMENTS`.

Config lives at `~/.uncle-bob/config.json`:

```json
{
  "enabled": true,
  "plan_review": false,
  "diff_line_threshold": 30,
  "model": "auto",
  "bare": "off",
  "principles_v1": ["SOLID", "Naming", "Functions"]
}
```

- `enabled` — master switch for the entire plugin. When `false`, every hook exits silently (including plan review). Default `true`.
- `plan_review` — opt-in Clean Architecture gate for plan-mode output and plan/spec files. Default `false`. Only fires when `enabled !== false`.
- `model` — which model the review spawns call. One of `auto` | `opus` | `sonnet` | `haiku`. Default `auto` (no `--model` flag → CLI default applies). Invalid values are treated as `auto`.
- `bare` — whether review spawns use `claude --bare`. One of `on` | `off`. Default `off`. When `on`, the reviewing sub-claude skips plugin sync, CLAUDE.md auto-discovery, keychain, auto-memory, and background prefetches — faster and avoids hook-recursion, but auth becomes strictly `ANTHROPIC_API_KEY` (OAuth/keychain ignored). Use to route review cost to an API key instead of the Max subscription.

## Actions

### `--enable`
Write `~/.uncle-bob/config.json` with `"enabled": true`, preserving any other keys (notably `plan_review`, `model`, `bare`). Create parent dir if missing. Report: "uncle-bob gate enabled — Stop hook will review turn diffs."

### `--disable`
Write `~/.uncle-bob/config.json` with `"enabled": false`, preserving any other keys. Every hook (code review and plan review alike) checks this flag first and exits silently when false — this is the master kill switch. Report: "uncle-bob gate disabled — all hooks will skip."

### `--enable-plan-review`
Write `~/.uncle-bob/config.json` with `"plan_review": true`, preserving any other keys. Report: "uncle-bob plan review enabled — PreToolUse ExitPlanMode and PostToolUse Write/Edit on plan/spec paths will gate via Clean Architecture canon."

### `--disable-plan-review`
Write `~/.uncle-bob/config.json` with `"plan_review": false`, preserving any other keys. Report: "uncle-bob plan review disabled — plan/spec hooks will skip."

### `--model <auto|opus|sonnet|haiku>`
Validate the value is one of `auto`, `opus`, `sonnet`, `haiku`. Reject anything else with:
```
Usage: /uncle-bob:setup --model <auto|opus|sonnet|haiku>
```
Write `~/.uncle-bob/config.json` with `"model": "<value>"`, preserving any other keys. Report: "uncle-bob review model set to `<value>` — next session's review spawns will use it." If `<value>` is `auto`, clarify: "no `--model` flag will be passed; the Claude CLI default applies."

### `--bare <on|off>`
Validate the value is `on` or `off`. Reject anything else with:
```
Usage: /uncle-bob:setup --bare <on|off>
```
Write `~/.uncle-bob/config.json` with `"bare": "<value>"`, preserving any other keys. Report for `on`: "uncle-bob review spawns will use `claude --bare` — billing routes to `ANTHROPIC_API_KEY`, plugin sync/keychain/CLAUDE.md skipped. Ensure `ANTHROPIC_API_KEY` is set in the environment or the spawn will fail." Report for `off`: "uncle-bob review spawns will NOT use `--bare` — normal OAuth/keychain auth applies."

### `--status` (default if no argument)
Read current config. Report:
- enabled: true/false
- plan_review: true/false
- diff_line_threshold: N
- model: auto/opus/sonnet/haiku
- bare: on/off
- audit entries in `~/.uncle-bob/audit.jsonl` (count only, no content)
- session snapshot: present/absent for current session_id

### Invalid / missing argument
If `$ARGUMENTS` is anything other than one of the flags above, show:
```
Usage: /uncle-bob:setup [--enable | --disable | --enable-plan-review | --disable-plan-review | --model <auto|opus|sonnet|haiku> | --bare <on|off> | --status]
```

## Notes

- Hooks are snapshotted at CC startup — toggling any knob (including `model` and `bare`) takes effect on next session (`/reload-plugins` doesn't refresh hooks).
- Config is shared across all projects. There's no per-project override yet — that's v2.
- `plan_review` triggers on two events: `PreToolUse ExitPlanMode` (reviews the plan text before the agent leaves plan mode) and `PostToolUse Write|Edit` filtered to paths inside a `plans/` or `specs/` directory, files ending in `-plan.md`/`_plan.md`/`.plan.md`/`-spec.md`/`_spec.md`/`.spec.md`, or the exact names `PLAN.md` / `SPEC.md`.
- Review spawns always pass these invariants: `--print`, `--no-session-persistence` (don't pollute `/resume`), `--tools ""` (reviews are text-only), `--remote-control-session-name-prefix uncle-bob-review` (mark ephemeral reviews in any RC UI). There is no CLI flag to fully disable Remote Control; `--bare on` is the only way to guarantee it stays off because it skips background prefetches.
