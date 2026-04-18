#!/usr/bin/env node
// PostToolUse hook for Write|Edit. Tier-1 regex scanner.
// Reads tool_input + tool_response, scans new content, appends hits to a per-session scratch file.
// Never blocks. Best-effort logging only.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function loadScanner() {
  const mod = await import(path.join(SCRIPT_DIR, "lib", "regex-scanner.mjs"));
  return mod;
}

function readHookInput() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
  } catch {
    return {};
  }
}

function scratchPathFor(sessionId) {
  const dir = path.join(process.env.HOME ?? "", ".uncle-bob", "sessions", sessionId || "_default");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "grade-card.jsonl");
}

function pickContent(toolInput, toolName) {
  if (toolName === "Write") return { content: toolInput.content, file: toolInput.file_path };
  if (toolName === "Edit") return { content: toolInput.new_string, file: toolInput.file_path };
  return { content: null, file: null };
}

async function main() {
  const input = readHookInput();
  const toolName = input.tool_name ?? "";
  if (!["Write", "Edit"].includes(toolName)) return;

  const { content, file } = pickContent(input.tool_input ?? {}, toolName);
  if (!content) return;

  const { scanContent, isSourceFile } = await loadScanner();
  if (!file || !isSourceFile(file)) return;
  const findings = scanContent(content, file);
  if (!findings.length) return;

  const scratch = scratchPathFor(input.session_id ?? "_default");
  const ts = new Date().toISOString();
  for (const f of findings) {
    fs.appendFileSync(scratch, JSON.stringify({ ts, tool: toolName, ...f }) + "\n");
  }
}

main().catch(() => { /* never block on hook errors */ });
