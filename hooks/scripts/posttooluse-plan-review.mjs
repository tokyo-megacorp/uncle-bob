#!/usr/bin/env node
// PostToolUse hook — Write|Edit on plan/spec files.
// When config.plan_review === true and the written file is a plan/spec, runs a
// Clean Architecture review and blocks (with corrective feedback) on violations.
// The file is already on disk when this hook fires — use fs.readFileSync for Edit.

import fs from "node:fs";
import process from "node:process";
import {
  readHookInput,
  emitDecision,
  logNote,
  readConfig,
  appendAudit,
  runReview,
} from "./lib/plan-review.mjs";

const PLAN_SPEC_PATTERNS = [
  /(^|\/)plans?\//i,
  /(^|\/)specs?\//i,
  /[._-](plan|spec)\.md$/i,
  /^(PLAN|SPEC)\.md$/,
];

function isPlanSpecPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return PLAN_SPEC_PATTERNS.some(re => re.test(normalized));
}

function readPostEditContent(toolInput, toolName) {
  if (toolName === "Write") return toolInput.content ?? "";
  try { return fs.readFileSync(toolInput.file_path, "utf8"); }
  catch { return ""; }
}

// Returns the file content string if this event warrants a review, or null to skip.
// Skips when: tool is not Write/Edit, path is not a plan/spec, file is unreadable,
// or content is blank (blank = audit-logged and skipped).
function extractAndValidateContent(input, toolName) {
  if (!["Write", "Edit"].includes(toolName)) return null;

  const filePath = input.tool_input?.file_path ?? "";
  if (!isPlanSpecPath(filePath)) return null;

  const content = readPostEditContent(input.tool_input ?? {}, toolName);
  if (!content.trim()) {
    appendAudit({ hook: "posttooluse-plan-review", session_id: input.session_id, path: filePath, ok: true, reason: "empty content — skipped" });
    return null;
  }
  return content;
}

function main() {
  const config = readConfig();
  if (config.plan_review !== true) return;

  const input = readHookInput();
  const content = extractAndValidateContent(input, input.tool_name ?? "");
  if (content === null) return;

  const filePath = input.tool_input?.file_path ?? "";
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const sessionId = input.session_id ?? "_default";

  const review = runReview(cwd, content);
  appendAudit({ hook: "posttooluse-plan-review", session_id: sessionId, path: filePath, ok: review.ok, reason: review.reason });

  if (!review.ok) {
    emitDecision({ decision: "block", reason: review.reason });
    return;
  }
  logNote(review.reason);
}

main();
