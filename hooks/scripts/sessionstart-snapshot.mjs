#!/usr/bin/env node
// SessionStart hook. Captures the pre-session git diff baseline so the Stop hook
// can later diff against the snapshot — not the working tree (which may already be
// regex-mutated). Mitigates the "ghost approval" risk identified in the matrix.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

function snapshotDirFor(sessionId) {
  const dir = path.join(process.env.HOME ?? "", ".uncle-bob", "sessions", sessionId || "_default");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function captureBaseline(cwd, dir) {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  if (head.status !== 0) return; // not a git repo
  const baselineSha = head.stdout.trim();
  fs.writeFileSync(path.join(dir, "baseline.sha"), baselineSha);

  const dirty = spawnSync("git", ["diff", "HEAD"], { cwd, encoding: "utf8" });
  if (dirty.status === 0) {
    fs.writeFileSync(path.join(dir, "baseline.diff"), dirty.stdout || "");
  }
}

function loadConfig() {
  const cfgPath = path.join(process.env.HOME ?? "", ".uncle-bob", "config.json");
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    return { enabled: true };
  }
}

function main() {
  const config = loadConfig();
  if (!config.enabled) return;

  const input = readHookInput();
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const dir = snapshotDirFor(input.session_id ?? "_default");

  captureBaseline(cwd, dir);

  // Optional: rotate a tip-of-the-day from precepts as additionalContext.
  const tips = [
    "Functions should be small. Then smaller than that. Aim for under 20 lines.",
    "Boolean parameters telegraph that the function does more than one thing.",
    "Names should reveal intent — d → elapsedTimeInDays.",
    "A class should have one and only one reason to change.",
    "Magic numbers are not searchable. Name the constant."
  ];
  const tip = tips[Math.floor(Math.random() * tips.length)];
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `Uncle Bob tip — ${tip}`
    }
  }) + "\n");
}

main();
