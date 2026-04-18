#!/usr/bin/env node
// PreCompact hook. Before context compaction, summarise this session's smell history
// from the audit log and inject it as additionalContext so the compacted session
// retains the canon-violation pattern across token windows.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const AUDIT_PATH = path.join(process.env.HOME ?? "", ".uncle-bob", "audit.jsonl");

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

function readSessionEntries(sessionId) {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  return fs.readFileSync(AUDIT_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(entry => entry && entry.session_id === sessionId);
}

function summarise(entries) {
  const total = entries.length;
  if (!total) return null;
  const blocks = entries.filter(e => e.ok === false).length;
  const firstTs = entries[0]?.ts;
  const lastTs = entries[entries.length - 1]?.ts;
  return [
    `Uncle Bob — session smell summary preserved across compaction:`,
    `- ${total} canon checks (${blocks} BLOCK verdicts) between ${firstTs} and ${lastTs}.`,
    `- Tail violations: ${entries.slice(-3).map(e => e.reason ?? "ALLOW").join(" | ")}`
  ].join("\n");
}

function main() {
  const input = readHookInput();
  const summary = summarise(readSessionEntries(input.session_id ?? "_default"));
  if (!summary) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreCompact",
      additionalContext: summary
    }
  }) + "\n");
}

main();
