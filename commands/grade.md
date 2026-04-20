---
description: Show canon-review grade report — pass rate, skip rate, avg elapsed, recent fail reasons. Reads ~/.uncle-bob/audit.jsonl.
argument-hint: "[--all]"
allowed-tools: Bash(node:*), Bash(test:*)
---

Print the uncle-bob grade report based on `$ARGUMENTS`.

## Steps

**1.** Check if `~/.uncle-bob/audit.jsonl` exists:

```bash
test -f ~/.uncle-bob/audit.jsonl
```

If missing → print:

```
uncle-bob grade — no data yet
Run a few sessions with the plugin enabled, then try again.
```

Stop here.

**2.** Run this Node.js script to parse the audit log. Pass `--all` when `$ARGUMENTS` contains `--all`:

```bash
node -e "
const fs = require('fs');
const path = process.env.HOME + '/.uncle-bob/audit.jsonl';
const lines = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/).filter(Boolean);
const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const all = process.argv.includes('--all');

let scope, filtered;
if (all) {
  scope = 'all sessions';
  filtered = entries;
} else {
  const last = entries[entries.length - 1];
  const sid = last?.session_id;
  scope = sid ? ('session ' + sid.slice(0, 8)) : 'latest session';
  filtered = sid ? entries.filter(e => e.session_id === sid) : entries;
}

const completed = filtered.filter(e => e.phase === 'completed');
const skipped   = filtered.filter(e => e.phase === 'skipped');
const pass      = completed.filter(e => e.ok === true).length;
const fail      = completed.filter(e => e.ok === false).length;
const total     = completed.length + skipped.length;
const passRate  = completed.length ? (pass / completed.length * 100).toFixed(0) + '%' : 'N/A';
const skipRate  = total ? (skipped.length / total * 100).toFixed(0) + '%' : 'N/A';
const avgMs     = completed.length
  ? Math.round(completed.reduce((s, e) => s + (e.elapsed_ms || 0), 0) / completed.length)
  : null;
const recentFails = completed.filter(e => e.ok === false).slice(-5).reverse()
  .map(e => e.reason || '(no reason recorded)');

console.log(JSON.stringify({ scope, total, completed: completed.length, skipped: skipped.length, pass, fail, passRate, skipRate, avgMs, recentFails }));
" -- $ARGUMENTS
```

**3.** Parse the JSON output and render:

```
uncle-bob grade — <scope>
─────────────────────────────────────
Stop-hook invocations:  <total>
  LLM reviews:          <completed>  (<pass> pass / <fail> fail)
  Tier-1 skips:         <skipped>
Pass rate:              <passRate>
Skip rate:              <skipRate>
Avg review time:        <avgMs>ms    (omit if null)

Recent FAILs (last ≤5):
  1. <reason>
  2. <reason>
  ...
```

If `recentFails` is empty, print `  (none — clean session)` instead.

## Flags

### (no argument)
Scope to the **most recent session** — the `session_id` of the last entry in audit.jsonl.

### `--all`
Aggregate across **all sessions** in audit.jsonl.

## Notes

- Audit log is written only by the Stop hook. `/uncle-bob:review` calls do NOT write to it.
- `Tier-1 skips` = Stop hook short-circuited before spawning LLM (Tier-1 regex caught smells, OR diff was below the 30-line threshold).
- This command is read-only — it never writes to audit.jsonl.
