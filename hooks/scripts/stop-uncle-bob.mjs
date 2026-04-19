#!/usr/bin/env node
// Stop hook — Tier-2 LLM review. Conditional: only runs claude --print when
// (1) Tier-1 regex already cleared the turn (no double-punishment), and
// (2) the turn diff exceeds DIFF_LINE_THRESHOLD (semantic check is worth the cost).
// Diff is computed against the pre-turn snapshot captured by SessionStart, not the
// working tree — avoids "ghost approval" where regex-mutated code looks clean to LLM.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildClaudeArgs } from "./lib/plan-review.mjs";

const STOP_REVIEW_TIMEOUT_MS = 15 * 60 * 1000;
const DIFF_LINE_THRESHOLD = 30;
const COOLDOWN_MS = 60_000;
const MS_PER_SECOND = 1000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
// hooks/scripts/ → hooks/ → plugin root
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const CONFIG_PATH = path.join(process.env.HOME ?? "", ".uncle-bob", "config.json");
const AUDIT_PATH = path.join(process.env.HOME ?? "", ".uncle-bob", "audit.jsonl");

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

function emitDecision(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function logNote(message) {
  if (message) process.stderr.write(`[uncle-bob] ${message}\n`);
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return { enabled: true }; }
}

function isEnabled(config) {
  if (process.env.UNCLE_BOB_ENABLED === "1") return true;
  if (process.env.UNCLE_BOB_ENABLED === "0") return false;
  return !!config.enabled;
}

function appendAudit(entry) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch { /* best effort */ }
}

function lastCompletedMs(sessionId) {
  try {
    const lines = fs.readFileSync(AUDIT_PATH, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.session_id === sessionId && entry.phase === "completed") return new Date(entry.ts).getTime();
      } catch { /* skip */ }
    }
  } catch { /* no file */ }
  return 0;
}

function loadFile(relative) {
  return fs.readFileSync(path.join(ROOT_DIR, relative), "utf8");
}

function sessionDir(sessionId) {
  return path.join(process.env.HOME ?? "", ".uncle-bob", "sessions", sessionId || "_default");
}

function turnDiff(cwd, sessionId) {
  const baselineSha = (() => {
    try { return fs.readFileSync(path.join(sessionDir(sessionId), "baseline.sha"), "utf8").trim(); }
    catch { return null; }
  })();
  if (!baselineSha) {
    const fallback = spawnSync("git", ["diff", "HEAD"], { cwd, encoding: "utf8" });
    return fallback.status === 0 ? fallback.stdout : "";
  }
  const since = spawnSync("git", ["diff", `${baselineSha}..HEAD`], { cwd, encoding: "utf8" });
  const dirty = spawnSync("git", ["diff", "HEAD"], { cwd, encoding: "utf8" });
  return [since.stdout ?? "", dirty.stdout ?? ""].join("\n").trim();
}

function tier1HasHits(sessionId) {
  const scratch = path.join(sessionDir(sessionId), "grade-card.jsonl");
  if (!fs.existsSync(scratch)) return false;
  return fs.readFileSync(scratch, "utf8").trim().length > 0;
}

function buildPrompt(diff, lastAssistantMessage) {
  const template = loadFile("hooks/prompts/stop-review-gate.md");
  const block = [
    lastAssistantMessage ? `Previous Claude response:\n${lastAssistantMessage}` : "",
    diff ? `\nTurn diff (against pre-turn baseline):\n\`\`\`diff\n${diff.slice(0, 12000)}\n\`\`\`` : ""
  ].filter(Boolean).join("\n");
  return template.replace("{{CLAUDE_RESPONSE_BLOCK}}", block);
}

function parseReview(rawOutput) {
  const text = String(rawOutput ?? "").trim();
  if (!text) return { ok: false, reason: "Uncle Bob review returned no output." };
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  if (firstLine.startsWith("ALLOW:")) return { ok: true, reason: firstLine };
  if (firstLine.startsWith("BLOCK:")) {
    return {
      ok: false,
      reason: `Uncle Bob review found a canon violation that needs a fix before stopping: ${firstLine.slice(6).trim()}`
    };
  }
  return { ok: false, reason: `Uncle Bob review returned malformed output. First line: ${firstLine.slice(0, 120)}` };
}

function runReview({ cwd, diff, lastAssistantMessage, config, sessionId }) {
  const prompt = buildPrompt(diff, lastAssistantMessage);
  const precepts = loadFile("hooks/precepts/_summary.md");
  const args = [
    ...buildClaudeArgs(config),
    "--system-prompt", precepts,
    prompt,
  ];

  // Observability: capture stderr of sub-Claude to a live-tailable log file.
  const logPath = path.join(sessionDir(sessionId), "stop-review.stderr.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const header = `\n--- started ${new Date().toISOString()} model=${config.model ?? "default"} bare=${config.bare === "on"} prompt_chars=${prompt.length} ---\n`;
  fs.appendFileSync(logPath, header);
  const logFd = fs.openSync(logPath, "a");

  let result;
  try {
    result = spawnSync("claude", args, {
      cwd, encoding: "utf8", timeout: STOP_REVIEW_TIMEOUT_MS,
      stdio: ["ignore", "pipe", logFd],
    });
  } finally {
    try { fs.closeSync(logFd); } catch { /* best effort */ }
  }

  if (result.error?.code === "ETIMEDOUT") {
    return { ok: false, reason: "Uncle Bob review timed out after 15 minutes." };
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim().slice(0, 200);
    return { ok: false, reason: detail ? `Uncle Bob review failed: ${detail}` : "Uncle Bob review failed with no output." };
  }
  return parseReview(result.stdout);
}

function main() {
  const config = readConfig();
  if (!isEnabled(config)) return;

  const input = readHookInput();
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const sessionId = input.session_id ?? "_default";

  const diff = turnDiff(cwd, sessionId);
  const diffLines = diff.split(/\r?\n/).filter(l => l.startsWith("+") || l.startsWith("-")).length;
  if (diffLines < DIFF_LINE_THRESHOLD) {
    appendAudit({ session_id: sessionId, phase: "skipped", reason: `diff ${diffLines} lines < threshold` });
    return;
  }

  const cooldownRemaining = COOLDOWN_MS - (Date.now() - lastCompletedMs(sessionId));
  if (cooldownRemaining > 0) {
    appendAudit({ session_id: sessionId, phase: "skipped", reason: `cooldown ${Math.ceil(cooldownRemaining / MS_PER_SECOND)}s remaining` });
    return;
  }

  appendAudit({
    session_id: sessionId,
    phase: "started",
    model: config.model ?? "default",
    bare: config.bare === "on",
  });

  const tsStart = Date.now();
  let reviewCompleted = false;
  const killHandler = () => {
    if (!reviewCompleted) {
      appendAudit({ session_id: sessionId, phase: "killed", elapsed_ms: Date.now() - tsStart });
    }
  };
  process.once("SIGTERM", killHandler);
  process.once("SIGINT", killHandler);
  const review = runReview({
    cwd,
    diff,
    lastAssistantMessage: String(input.last_assistant_message ?? "").trim(),
    config,
    sessionId,
  });
  reviewCompleted = true;
  process.removeListener("SIGTERM", killHandler);
  process.removeListener("SIGINT", killHandler);
  const elapsedMs = Date.now() - tsStart;
  appendAudit({ session_id: sessionId, phase: "completed", elapsed_ms: elapsedMs, cwd, ok: review.ok, reason: review.reason });

  if (!review.ok) {
    emitDecision({ decision: "block", reason: review.reason });
    return;
  }
  logNote(review.reason);
}

main();
