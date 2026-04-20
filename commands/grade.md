---
description: Show canon-review grade report — pass rate, skip rate, avg elapsed, recent fail reasons. Reads ~/.uncle-bob/audit.jsonl.
argument-hint: "[--all | --session]"
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

**2.** Run this Node.js script to parse both the audit log and smell ledger:

```bash
node -e "
const fs = require('fs');
const path = process.env.HOME + '/.uncle-bob/audit.jsonl';
const lines = fs.readFileSync(path, 'utf8').trim().split(/\r?\n/).filter(Boolean);
const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const args = process.argv.slice(1);
const all     = args.includes('--all');
const session = args.includes('--session');

let scope, filtered;
if (all) {
  scope = 'all sessions';
  filtered = entries;
} else if (session) {
  const last = entries[entries.length - 1];
  const sid = last?.session_id;
  scope = sid ? ('session ' + sid.slice(0, 8)) : 'latest session';
  filtered = sid ? entries.filter(e => e.session_id === sid) : entries;
} else {
  const cwd = process.cwd();
  filtered = entries.filter(e => e.cwd && e.cwd.startsWith(cwd));
  scope = cwd.replace(process.env.HOME, '~');
  if (!filtered.length) {
    // fallback: latest session if cwd matches nothing
    const last = entries[entries.length - 1];
    const sid = last?.session_id;
    scope = (sid ? 'session ' + sid.slice(0, 8) : 'latest session') + ' (no cwd match)';
    filtered = sid ? entries.filter(e => e.session_id === sid) : entries;
  }
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

// Smell ledger — per-principle breakdown
const ledgerPath = process.env.HOME + '/.uncle-bob/smell-ledger.jsonl';
let smellBreakdown = [];
try {
  const llines = require('fs').readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const lentries = llines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const lfiltered = all ? lentries : lentries.filter(e => e.cwd && e.cwd.startsWith(process.cwd()));
  const byPrinciple = {};
  for (const e of lfiltered) {
    byPrinciple[e.principle] = (byPrinciple[e.principle] || 0) + 1;
  }
  smellBreakdown = Object.entries(byPrinciple).sort((a, b) => b[1] - a[1]);
} catch { /* ledger may not exist yet */ }

console.log(JSON.stringify({ scope, total, completed: completed.length, skipped: skipped.length, pass, fail, passRate, skipRate, avgMs, recentFails, smellBreakdown }));
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

If `smellBreakdown` is non-empty, append:

```
Tier-1 smell breakdown (all-time):
  FunctionSize      ×14  ████████████████
  MagicNumber       ×6   ██████
  SingleLetterName  ×3   ███
  ...
```

Use a proportional bar (max 16 chars). Omit section entirely if `smellBreakdown` is empty (ledger not yet populated).

## Flags

### (no argument)
Default: filter by **current working directory** (`cwd` field in audit entries) — shows only reviews from this project, across all sessions. Falls back to latest session if no `cwd` match found.

### `--session`
Scope to the **most recent session** only (last `session_id` in audit.jsonl).

### `--all`
Aggregate across **all projects and sessions** in audit.jsonl.

## Notes

- Audit log is written only by the Stop hook. `/uncle-bob:review` calls do NOT write to it.
- `Tier-1 skips` = Stop hook short-circuited before spawning LLM (Tier-1 regex caught smells, OR diff was below the 30-line threshold).
- This command is read-only — it never writes to audit.jsonl.
