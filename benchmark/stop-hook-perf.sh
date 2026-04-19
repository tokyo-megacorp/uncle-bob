#!/usr/bin/env bash
# Benchmarks each phase of the stop hook's claude --print startup cost.
# Usage: ./benchmark/stop-hook-perf.sh
# Keeps uncle-bob disabled globally; uses UNCLE_BOB_ENABLED=1 only for full test.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT="Return the single word: ALLOW"
SYSTEM="You are a code reviewer. Follow output format exactly."

ts() { node -e "process.stdout.write(String(Date.now()))"; }

elapsed() {
  local start=$1 end=$2
  echo $(( end - start ))ms
}

run_timed() {
  local label=$1; shift
  local t0; t0=$(ts)
  "$@" > /dev/null 2>&1
  local t1; t1=$(ts)
  echo "  $label: $(elapsed $t0 $t1)"
}

echo "=== uncle-bob stop-hook perf benchmark ==="
echo "Plugin root: $PLUGIN_ROOT"
echo

echo "Phase 1 — CC binary cold start (claude --version):"
run_timed "claude --version" claude --version

echo
echo "Phase 2 — claude --print, no flags:"
run_timed "bare --print" claude --print --no-session-persistence "$PROMPT"

echo
echo "Phase 3 — claude --print + isolation flags (no --plugin-dir):"
run_timed "--print + isolation (no plugin-dir)" claude \
  --print \
  --no-session-persistence \
  --tools "" \
  --strict-mcp-config \
  --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands \
  "$PROMPT"

echo
echo "Phase 4 — claude --print + full isolation (with --plugin-dir):"
ISOLATION_DIR="$(node -e "
  const os = require('os'), path = require('path');
  const d = path.join(os.homedir(), '.uncle-bob', 'isolation-plugin-dir');
  require('fs').mkdirSync(d, { recursive: true });
  console.log(d);
")"
run_timed "--print + full isolation" claude \
  --print \
  --no-session-persistence \
  --tools "" \
  --strict-mcp-config \
  --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands \
  --plugin-dir "$ISOLATION_DIR" \
  "$PROMPT"

echo
echo "Phase 5 — full hook invocation (UNCLE_BOB_ENABLED=1):"
PAYLOAD='{"cwd":"'"$PLUGIN_ROOT"'","session_id":"bench","last_assistant_message":"Fixed a typo in README."}'
t0=$(ts)
echo "$PAYLOAD" | UNCLE_BOB_ENABLED=1 node "$PLUGIN_ROOT/hooks/scripts/stop-uncle-bob.mjs" > /dev/null 2>&1 || true
t1=$(ts)
echo "  full hook: $(elapsed $t0 $t1)"

echo
echo "=== done ==="
