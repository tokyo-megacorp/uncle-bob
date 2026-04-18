---
description: Configure the uncle-bob plugin — toggle the Stop gate, the opt-in plan review, or check status.
argument-hint: "[--enable | --disable | --enable-plan-review | --disable-plan-review | --status]"
allowed-tools: Bash(mkdir:*), Bash(test:*), Read, Write, Edit
---

Configure the uncle-bob plugin based on `$ARGUMENTS`.

Config lives at `~/.uncle-bob/config.json`:

```json
{
  "enabled": true,
  "plan_review": false,
  "diff_line_threshold": 30,
  "principles_v1": ["SOLID", "Naming", "Functions"]
}
```

- `enabled` — master switch for the code-review stack (Stop gate, PostToolUse regex, SessionStart snapshot, PreCompact summary, UserPromptSubmit grade card). Default `true`.
- `plan_review` — opt-in Clean Architecture gate for plan-mode output and plan/spec files. Default `false`.

## Actions

### `--enable`
Write `~/.uncle-bob/config.json` with `"enabled": true`, preserving any other keys (notably `plan_review`). Create parent dir if missing. Report: "uncle-bob gate enabled — Stop hook will review turn diffs."

### `--disable`
Write `~/.uncle-bob/config.json` with `"enabled": false`, preserving any other keys. The Stop/SessionStart/PostToolUse hooks all check this flag first and exit silently when false. Report: "uncle-bob gate disabled — hooks will skip."

### `--enable-plan-review`
Write `~/.uncle-bob/config.json` with `"plan_review": true`, preserving any other keys. Report: "uncle-bob plan review enabled — PreToolUse ExitPlanMode and PostToolUse Write/Edit on plan/spec paths will gate via Clean Architecture canon."

### `--disable-plan-review`
Write `~/.uncle-bob/config.json` with `"plan_review": false`, preserving any other keys. Report: "uncle-bob plan review disabled — plan/spec hooks will skip."

### `--status` (default if no argument)
Read current config. Report:
- enabled: true/false
- plan_review: true/false
- diff_line_threshold: N
- audit entries in `~/.uncle-bob/audit.jsonl` (count only, no content)
- session snapshot: present/absent for current session_id

### Invalid / missing argument
If `$ARGUMENTS` is anything other than one of the flags above, show:
```
Usage: /uncle-bob:setup [--enable | --disable | --enable-plan-review | --disable-plan-review | --status]
```

## Notes

- Hooks are snapshotted at CC startup — toggling `enabled` or `plan_review` takes effect on next session (`/reload-plugins` doesn't refresh hooks).
- Config is shared across all projects. There's no per-project override yet — that's v2.
- `plan_review` triggers on two events: `PreToolUse ExitPlanMode` (reviews the plan text before the agent leaves plan mode) and `PostToolUse Write|Edit` filtered to paths matching `plans?/`, `specs?/`, `*-plan.md`, `*.spec.md`, `PLAN.md`, or `SPEC.md`.
