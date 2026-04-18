#!/usr/bin/env node
// UserPromptSubmit hook. Reads scratch file written by PostToolUse scanner,
// emits a grade-card as additionalContext for the next turn, then clears the scratch.
// Idempotent: if scratch is empty, emits nothing.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SENTINEL = "<!-- uncle-bob-grade-card -->";

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

function scratchPathFor(sessionId) {
  const dir = path.join(process.env.HOME ?? "", ".uncle-bob", "sessions", sessionId || "_default");
  return path.join(dir, "grade-card.jsonl");
}

function readFindings(scratch) {
  if (!fs.existsSync(scratch)) return [];
  const raw = fs.readFileSync(scratch, "utf8").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function renderGradeCard(findings) {
  const byPrinciple = {};
  for (const f of findings) {
    (byPrinciple[f.principle] ??= []).push(f);
  }
  const sections = Object.entries(byPrinciple).map(([principle, hits]) => {
    const lines = hits.slice(0, 5).map(h => `  - ${h.file}:${h.line} — ${h.why}\n    fix: ${h.fix}`);
    const more = hits.length > 5 ? `\n  - ... and ${hits.length - 5} more` : "";
    return `**${principle}** (${hits.length})\n${lines.join("\n")}${more}`;
  });
  return [
    SENTINEL,
    "Uncle Bob — grade-card from your last turn (auto-detected, no LLM):",
    "",
    ...sections,
    "",
    "Address these before the next Stop, or `/uncle-bob:setup --disable` to silence."
  ].join("\n");
}

function main() {
  const input = readHookInput();
  const scratch = scratchPathFor(input.session_id ?? "_default");
  const findings = readFindings(scratch);
  if (!findings.length) return;

  // Don't double-inject: caller already saw it if previous prompt contained the sentinel.
  const previousPrompt = String(input.prompt ?? "");
  if (previousPrompt.includes(SENTINEL)) return;

  const card = renderGradeCard(findings);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: card
    }
  }) + "\n");

  // Clear the scratch — one delivery per batch.
  try { fs.unlinkSync(scratch); } catch { /* best effort */ }
}

main();
