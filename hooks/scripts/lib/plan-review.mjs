// Shared helpers for the plan-review hook pair (pretooluse + posttooluse).
// Pure-ish helpers only — no side effects on import. main() lives in each script.

import fs from "node:fs";
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

// Low-level: spawns claude and returns { stdout, ok, reason } where ok/reason
// reflect only transport errors (timeout, non-zero exit). Callers parse stdout.
function callClaude(prompt, precepts, cwd) {
  const result = spawnSync("claude", ["--print", "--append-system-prompt", precepts, prompt], {
    cwd, encoding: "utf8", timeout: PLAN_REVIEW_TIMEOUT_MS
  });
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
