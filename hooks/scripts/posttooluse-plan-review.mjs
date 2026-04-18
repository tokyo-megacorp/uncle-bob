#!/usr/bin/env node
// PostToolUse hook — Write|Edit on plan/spec files.
// When config.plan_review === true and the written file is a plan/spec, runs a
// Clean Architecture review and blocks (with corrective feedback) on violations.
// The file is already on disk when this hook fires — use fs.readFileSync for Edit.

import fs from "node:fs";
import process from "node:process";
import {
  readHookInput,
  readConfig,
  appendAudit,
  runReview,
  reportReviewOutcome,
} from "./lib/plan-review.mjs";

const BLOCK_SUFFIX = "Edit the file to resolve the structural violation above.";

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

// Pure predicate: true when this hook event targets a plan/spec file.
function isPlanSpecTarget(input, toolName) {
  if (!["Write", "Edit"].includes(toolName)) return false;
  return isPlanSpecPath(input.tool_input?.file_path ?? "");
}

function readPostEditContent(toolInput, toolName) {
  if (toolName === "Write") return toolInput.content ?? "";
  try { return fs.readFileSync(toolInput.file_path, "utf8"); }
  catch { return ""; }
}

// Pure query: returns content string if reviewable, null if blank/unreadable.
function extractAndValidateContent(input, toolName) {
  const content = readPostEditContent(input.tool_input ?? {}, toolName);
  return content.trim() ? content : null;
}

function main() {
  const config = readConfig();
  if (config.enabled === false) return;
  if (config.plan_review !== true) return;
  const input = readHookInput();
  const toolName = input.tool_name ?? "";
  if (!isPlanSpecTarget(input, toolName)) return;
  const filePath = input.tool_input?.file_path ?? "";
  const sessionId = input.session_id ?? "_default";
  const auditBase = { hook: "posttooluse-plan-review", session_id: sessionId, path: filePath };
  const content = extractAndValidateContent(input, toolName);
  if (content === null) {
    appendAudit({ ...auditBase, ok: true, reason: "empty content — skipped" });
    return;
  }
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const review = runReview(cwd, content, BLOCK_SUFFIX);
  reportReviewOutcome(review, auditBase);
}

try {
  main();
} catch (err) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `uncle-bob plan review hook crashed: ${err?.message ?? err}. Check plugin install.`
  }) + "\n");
  process.exit(0);
}
