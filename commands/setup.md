---
description: Configure the uncle-bob plugin — toggle the Stop gate, set thresholds, check status.
argument-hint: "[--enable | --disable | --status]"
allowed-tools: Bash(mkdir:*), Bash(test:*), Read, Write, Edit
---

Configure the uncle-bob plugin based on `$ARGUMENTS`.

Config lives at `~/.uncle-bob/config.json`:

```json
{
  "enabled": true,
  "diff_line_threshold": 30,
  "principles_v1": ["SOLID", "Naming", "Functions"]
}
```

## Actions

### `--enable`
Write `~/.uncle-bob/config.json` with `"enabled": true`. Create parent dir if missing. Report: "uncle-bob gate enabled — Stop hook will review turn diffs."

### `--disable`
Write `~/.uncle-bob/config.json` with `"enabled": false`. The Stop/SessionStart/PostToolUse hooks all check this flag first and exit silently when false. Report: "uncle-bob gate disabled — hooks will skip."

### `--status` (default if no argument)
Read current config. Report:
- enabled: true/false
- diff_line_threshold: N
- audit entries in `~/.uncle-bob/audit.jsonl` (count only, no content)
- session snapshot: present/absent for current session_id

### Invalid / missing argument
If `$ARGUMENTS` is anything other than `--enable` / `--disable` / `--status`, show:
```
Usage: /uncle-bob:setup [--enable | --disable | --status]
```

## Notes

- Hooks are snapshotted at CC startup — toggling `enabled` takes effect on next session (`/reload-plugins` doesn't refresh hooks).
- Config is shared across all projects. There's no per-project override yet — that's v2.
