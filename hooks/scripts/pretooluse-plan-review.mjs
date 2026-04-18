#!/usr/bin/env node
// PreToolUse hook — ExitPlanMode gate.
// Reads the plan text from tool_input.plan and runs a Clean Architecture review.
// Blocks exit-plan-mode when config.plan_review === true and the plan violates the canon.
// Silent exit (no output, exit 0) when plan_review is disabled or not set.

import process from "node:process";
import {
  readHookInput,
  readConfig,
  appendAudit,
  runReview,
  reportReviewOutcome,
} from "./lib/plan-review.mjs";

const BLOCK_SUFFIX = "Revise the plan and re-exit plan mode.";

function extractPlan(input) {
  return String(input.tool_input?.plan ?? "").trim();
}

function main() {
  const config = readConfig();
  if (config.enabled === false) return;
  if (config.plan_review !== true) return;
  const input = readHookInput();
  if (input.tool_name !== "ExitPlanMode") return;
  const sessionId = input.session_id ?? "_default";
  const auditBase = { hook: "pretooluse-plan-review", session_id: sessionId };
  const planContent = extractPlan(input);
  if (!planContent) {
    appendAudit({ ...auditBase, ok: true, reason: "empty plan — skipped" });
    return;
  }
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const review = runReview(cwd, planContent, BLOCK_SUFFIX);
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
