import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { buildClaudeArgs } from "../hooks/scripts/lib/plan-review.mjs";

const ISOLATION_PLUGIN_DIR = path.join(os.tmpdir(), "uncle-bob-empty-plugins");

const INVARIANT_PREFIX = [
  "--print",
  "--no-session-persistence",
  "--tools", "",
  "--remote-control-session-name-prefix", "uncle-bob-review",
  "--plugin-dir", ISOLATION_PLUGIN_DIR,
  "--strict-mcp-config",
  "--mcp-config", '{"mcpServers":{}}',
  "--disable-slash-commands",
];

test("buildClaudeArgs: empty config returns only the invariant prefix", () => {
  assert.deepEqual(buildClaudeArgs({}), INVARIANT_PREFIX);
});

test("buildClaudeArgs: no config (undefined) returns only the invariant prefix", () => {
  assert.deepEqual(buildClaudeArgs(), INVARIANT_PREFIX);
});

test("buildClaudeArgs: model=auto does NOT add --model", () => {
  const args = buildClaudeArgs({ model: "auto" });
  assert.equal(args.includes("--model"), false);
});

test("buildClaudeArgs: model=opus adds --model opus", () => {
  const args = buildClaudeArgs({ model: "opus" });
  assert.deepEqual(args, [...INVARIANT_PREFIX, "--model", "opus"]);
});

test("buildClaudeArgs: model=sonnet adds --model sonnet", () => {
  const args = buildClaudeArgs({ model: "sonnet" });
  assert.deepEqual(args, [...INVARIANT_PREFIX, "--model", "sonnet"]);
});

test("buildClaudeArgs: model=haiku adds --model haiku", () => {
  const args = buildClaudeArgs({ model: "haiku" });
  assert.deepEqual(args, [...INVARIANT_PREFIX, "--model", "haiku"]);
});

test("buildClaudeArgs: invalid model value is ignored (treated as auto)", () => {
  const args = buildClaudeArgs({ model: "gpt-5" });
  assert.equal(args.includes("--model"), false);
});

test("buildClaudeArgs: bare=on adds --bare flag", () => {
  const args = buildClaudeArgs({ bare: "on" });
  assert.deepEqual(args, [...INVARIANT_PREFIX, "--bare"]);
});

test("buildClaudeArgs: bare=off does NOT add --bare", () => {
  const args = buildClaudeArgs({ bare: "off" });
  assert.equal(args.includes("--bare"), false);
});

test("buildClaudeArgs: any other bare value is treated as off (no --bare)", () => {
  assert.equal(buildClaudeArgs({ bare: "auto" }).includes("--bare"), false);
  assert.equal(buildClaudeArgs({ bare: true }).includes("--bare"), false);
  assert.equal(buildClaudeArgs({ bare: 1 }).includes("--bare"), false);
});

test("buildClaudeArgs: bare=on + model=haiku composes both flags in that order", () => {
  const args = buildClaudeArgs({ bare: "on", model: "haiku" });
  assert.deepEqual(args, [...INVARIANT_PREFIX, "--bare", "--model", "haiku"]);
});

test("buildClaudeArgs: invariant prefix always present (position-stable)", () => {
  for (const config of [{}, { bare: "on" }, { model: "opus" }, { bare: "on", model: "sonnet" }]) {
    const args = buildClaudeArgs(config);
    assert.equal(args[0], "--print");
    assert.equal(args[1], "--no-session-persistence");
    assert.equal(args[2], "--tools");
    assert.equal(args[3], "");
    assert.equal(args[4], "--remote-control-session-name-prefix");
    assert.equal(args[5], "uncle-bob-review");
  }
});
