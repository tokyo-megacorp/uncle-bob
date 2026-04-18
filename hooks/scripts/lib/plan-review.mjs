// Shared helpers for the plan-review hook pair (pretooluse + posttooluse).
// Pure-ish helpers only — no side effects on import. main() lives in each script.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PLAN_REVIEW_TIMEOUT_MS = 15 * 60 * 1000;

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
// lib/ → scripts/ → hooks/ → plugin root
export const ROOT_DIR = path.resolve(LIB_DIR, "..", "..", "..");
export const CONFIG_PATH = path.join(process.env.HOME ?? "", ".uncle-bob", "config.json");
export const AUDIT_PATH = path.join(process.env.HOME ?? "", ".uncle-bob", "audit.jsonl");

export function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

export function emitDecision(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}

export function logNote(message) {
  if (message) process.stderr.write(`[uncle-bob] ${message}\n`);
}

export function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return {}; }
}

export function appendAudit(entry) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch { /* best effort */ }
}

export function loadFile(relative) {
  return fs.readFileSync(path.join(ROOT_DIR, relative), "utf8");
}

export function buildPrompt(planContent) {
  const template = loadFile("hooks/prompts/plan-review-gate.md");
  return template.replace("{{PLAN_CONTENT_BLOCK}}", planContent);
}

// Returns the raw first line of output with no suffix — callers compose the
// context-appropriate suffix (PreToolUse vs PostToolUse wording differs).
export function parseReview(rawOutput) {
  const text = String(rawOutput ?? "").trim();
  if (!text) return { ok: false, reason: "Plan review returned no output." };
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  if (firstLine.startsWith("ALLOW:")) return { ok: true, reason: firstLine };
  if (firstLine.startsWith("BLOCK:")) return { ok: false, reason: firstLine };
  return { ok: false, reason: `Plan review returned malformed output. First line: ${firstLine.slice(0, 120)}` };
}

// Ensures a stable empty plugin directory exists so --plugin-dir can point at it.
// Without an empty dir, omitting --plugin-dir lets the CLI auto-discover the user's
// plugins — which is exactly what adds 60+ seconds of plugin sync on cold start.
function ensureIsolationPluginDir() {
  const dir = path.join(os.tmpdir(), "uncle-bob-empty-plugins");
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* best effort */ }
  return dir;
}

// Pure-ish (touches /tmp once via ensureIsolationPluginDir): builds the invariant
// argv prefix for `claude` review spawns.
// Invariants (always on): --print (one-shot), --no-session-persistence (don't
// pollute /resume), --tools "" (review is text-in/text-out, no tools needed),
// --remote-control-session-name-prefix (mark ephemeral reviews in any RC UI),
// plus isolation flags that prevent the sub-claude from inheriting the user's
// plugins / MCPs / slash-commands — cold start goes from ~60s to ~5s. Bench
// evidence in CHANGELOG.
// Knobs: --bare when config.bare === "on" (routes billing to ANTHROPIC_API_KEY;
// even more minimal than the isolation flags, at the cost of OAuth). --model <x>
// when config.model ∈ {opus, sonnet, haiku}; "auto" or any other value means no
// --model flag (CLI default applies).
export function buildClaudeArgs(config = {}) {
  const args = [
    "--print",
    "--no-session-persistence",
    "--tools", "",
    "--remote-control-session-name-prefix", "uncle-bob-review",
    "--plugin-dir", ensureIsolationPluginDir(),
    "--strict-mcp-config",
    "--mcp-config", '{"mcpServers":{}}',
    "--disable-slash-commands",
  ];
  if (config.bare === "on") args.push("--bare");
  const { model } = config;
  if (model === "opus" || model === "sonnet" || model === "haiku") {
    args.push("--model", model);
  }
  return args;
}

// Low-level: spawns claude and returns { stdout, ok, reason } where ok/reason
// reflect only transport errors (ENOENT, timeout, non-zero exit). Callers parse stdout.
function callClaude(prompt, precepts, cwd) {
  const args = [
    ...buildClaudeArgs(readConfig()),
    "--system-prompt", precepts,
    prompt,
  ];
  const result = spawnSync("claude", args, {
    cwd, encoding: "utf8", timeout: PLAN_REVIEW_TIMEOUT_MS
  });
  if (result.error?.code === "ENOENT") {
    return { ok: false, reason: "Plan review failed: claude CLI not found on PATH. Install it and restart the session." };
  }
  if (result.error?.code === "ETIMEDOUT") {
    return { ok: false, reason: "Plan review timed out after 15 minutes." };
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim().slice(0, 200);
    return { ok: false, reason: detail ? `Plan review failed: ${detail}` : "Plan review failed with no output." };
  }
  return { ok: true, stdout: result.stdout };
}

// Orchestrates: build prompt → call claude → parse result → append blockSuffix on BLOCK.
export function runReview(cwd, planContent, blockSuffix) {
  const prompt = buildPrompt(planContent);
  const precepts = loadFile("hooks/precepts/_architecture.md");
  const claude = callClaude(prompt, precepts, cwd);
  if (!claude.ok) return claude;
  const parsed = parseReview(claude.stdout);
  if (!parsed.ok && blockSuffix) return { ...parsed, reason: `${parsed.reason} ${blockSuffix}` };
  return parsed;
}

// Writes the audit entry then emits the right signal: block on failure, note on success.
export function reportReviewOutcome(review, auditBase) {
  appendAudit({ ...auditBase, ok: review.ok, reason: review.reason });
  if (!review.ok) {
    emitDecision({ decision: "block", reason: review.reason });
    return;
  }
  logNote(review.reason);
}
