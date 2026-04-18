---
description: Run uncle-bob canon review on-demand — works on a file, the staged diff, or a git range. Same gate as the Stop hook, but you invoke it.
argument-hint: "[<file> | --staged | --since <ref>]"
allowed-tools: Bash(git:*), Bash(node:*), Read
---

Run the uncle-bob canon review against `$ARGUMENTS` without waiting for Stop.

## Targets

### `<path>` (a file or directory)
Read the target via `Read`. Invoke `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib/regex-scanner.mjs` on the content for Tier-1 auto-detectables. If none found, call `claude --print` with `hooks/precepts/_summary.md` as `--append-system-prompt` + the file content for Tier-2 semantic check.

### `--staged`
`git diff --cached` to capture the staged diff. Review with the same two-tier flow.

### `--since <ref>`
`git diff <ref>..HEAD` to capture changes since that commit. Review with the same flow.

### No argument
Default to `--staged`. If nothing is staged, report: "nothing to review — stage changes with `git add` first, or pass a file path."

## Output

Print a compact report:

```
uncle-bob review — <target>
─────────────────────────
Tier-1 (regex)
  FunctionSize × 2   at src/x.ts:42, src/y.ts:101
  FunctionArgs × 1   at src/z.ts:8
  (if none: "no Tier-1 hits")

Tier-2 (LLM)         (skipped — Tier-1 already flagged / skipped — only run on request)
  <claude --print output, verbatim first line>

Verdict: PASS | FAIL
```

Always print verdict on the last line. PASS = no violations. FAIL = at least one principle flagged.

## Notes

- On-demand review never blocks anything. It's a read-only lint pass.
- Tier-2 (LLM) runs unconditionally on explicit `/uncle-bob:review` calls — unlike the Stop hook which gates by diff size.
- Audit log at `~/.uncle-bob/audit.jsonl` is NOT written by this command — only the Stop hook writes audits.
