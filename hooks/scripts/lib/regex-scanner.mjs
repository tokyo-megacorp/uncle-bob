// Tier-1 regex smell detection. Cheap, no LLM. Auto-detectable subset of canon.
// Returns array of { principle, line, snippet, why, fix } for any hits found.

const SINGLE_LETTER_NAME = /\b(?:let|const|var|function|class)\s+([a-zA-Z])\s*[=:(]/g;
// Lookbehind excludes \w, _, and `-` so identifiers like `gpt-5`, `sha-256`,
// `claude-4-7`, `http-1`, `es-256` don't trigger. Combined with the in-string
// heuristic in scanMagicNumbers, this covers the overwhelming majority of
// model/version/codec names without needing a hardcoded whitelist.
const MAGIC_NUMBER = /\b(?<!\.)(?<![\w\-])([2-9]|[1-9]\d+)(?:\.\d+)?\b(?!\s*[)}>\]])/g;
const FLAG_BOOL_ARG = /function\s+\w+\s*\([^)]*\b(?:is|has|should|use|enable|disable)[A-Z]\w*\s*[?:]?\s*boolean/gi;
const ARITY_OVER_THREE = /function\s+(\w+)\s*\(([^)]*)\)/g;
const ARROW_ARITY_OVER_THREE = /\b(?:const|let)\s+(\w+)\s*=\s*\(([^)]+)\)\s*=>/g;
const FUNCTION_LOC_HEADER = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const ARROW_FN_HEADER = /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/;

const NOISE_NUMBER_CONTEXTS = /(?:port|status|HTTP|index|byte|version|year|days|hours|minutes|seconds)/i;

function countParams(paramList) {
  if (!paramList || !paramList.trim()) return 0;
  return paramList
    .replace(/<[^>]+>/g, "")
    .replace(/\{[^}]*\}/g, "obj")
    .replace(/\[[^\]]*\]/g, "arr")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean).length;
}

function lineOfMatch(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function scanFunctionLOC(content, filePath) {
  const lines = content.split(/\r?\n/);
  const findings = [];
  let inFn = null;
  let braceDepth = 0;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFn) {
      const headerMatch = line.match(FUNCTION_LOC_HEADER) ?? line.match(ARROW_FN_HEADER);
      if (headerMatch) {
        inFn = headerMatch[1];
        startLine = i + 1;
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        if (braceDepth === 0 && /=>\s*[^{]/.test(line)) {
          inFn = null;
        }
      }
    } else {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        const loc = i + 1 - startLine;
        if (loc > 20) {
          findings.push({
            principle: "FunctionSize",
            line: startLine,
            snippet: `function ${inFn}() ... ${loc} lines`,
            why: `Function "${inFn}" is ${loc} lines long; canon ceiling is 20.`,
            fix: `Extract sub-functions named for their intent and call them from "${inFn}".`
          });
        }
        inFn = null;
      }
    }
  }
  return findings;
}

function scanArity(content) {
  const findings = [];
  const matches = [...content.matchAll(ARITY_OVER_THREE), ...content.matchAll(ARROW_ARITY_OVER_THREE)];
  for (const m of matches) {
    const name = m[1];
    const arity = countParams(m[2]);
    if (arity >= 4) {
      findings.push({
        principle: "FunctionArgs",
        line: lineOfMatch(content, m.index),
        snippet: `${name}(${arity} params)`,
        why: `Function "${name}" takes ${arity} parameters; canon ceiling is 3.`,
        fix: `Group related args into an object/record, or split the function if args represent different responsibilities.`
      });
    }
  }
  return findings;
}

function scanFlagArgs(content) {
  const findings = [];
  for (const m of content.matchAll(FLAG_BOOL_ARG)) {
    findings.push({
      principle: "FlagArg",
      line: lineOfMatch(content, m.index),
      snippet: m[0].slice(0, 80),
      why: `Boolean parameter telegraphs the function does more than one thing.`,
      fix: `Split into two functions, one per branch (e.g., renderPage() + renderAdminPage()).`
    });
  }
  return findings;
}

function scanSingleLetterNames(content) {
  const findings = [];
  for (const m of content.matchAll(SINGLE_LETTER_NAME)) {
    const name = m[1];
    if (["i", "j", "k", "_"].includes(name)) continue;
    findings.push({
      principle: "IntentionRevealing",
      line: lineOfMatch(content, m.index),
      snippet: m[0],
      why: `Single-letter name "${name}" hides intent.`,
      fix: `Rename to reveal purpose (e.g., elapsedDays, currentUser).`
    });
  }
  return findings;
}

// Heuristic: a match is inside a string literal if the count of unescaped
// quote/backtick chars on the same line before the match index is odd.
// Catches `"gpt-5"`, `'ttl: 30s'`, backtick templates — not perfect for
// multi-line strings or ${expr} interpolations, but kills the noisiest cases.
function isInsideStringLiteral(lineText, columnIndex) {
  const before = lineText.slice(0, columnIndex);
  const doubles = (before.match(/(?<!\\)"/g) ?? []).length;
  const singles = (before.match(/(?<!\\)'/g) ?? []).length;
  const backticks = (before.match(/`/g) ?? []).length;
  return doubles % 2 === 1 || singles % 2 === 1 || backticks % 2 === 1;
}

function columnOfMatch(content, index) {
  const lastNewline = content.lastIndexOf("\n", index - 1);
  return lastNewline === -1 ? index : index - lastNewline - 1;
}

function scanMagicNumbers(content) {
  const findings = [];
  for (const m of content.matchAll(MAGIC_NUMBER)) {
    const lineIdx = lineOfMatch(content, m.index);
    const lineText = content.split(/\r?\n/)[lineIdx - 1] ?? "";
    if (NOISE_NUMBER_CONTEXTS.test(lineText)) continue;
    if (/^\s*(?:\/\/|\*|\/\*)/.test(lineText)) continue;
    if (isInsideStringLiteral(lineText, columnOfMatch(content, m.index))) continue;
    findings.push({
      principle: "SearchableNames",
      line: lineIdx,
      snippet: lineText.trim().slice(0, 80),
      why: `Magic number "${m[1]}" is not searchable.`,
      fix: `Extract to a named constant (e.g., const MAX_RETRIES = ${m[1]}).`
    });
  }
  return findings;
}

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts",
  ".py", ".go", ".rs", ".java", ".kt", ".swift", ".rb", ".php",
  ".c", ".cc", ".cpp", ".h", ".hpp", ".m", ".mm", ".cs"
]);

export function isSourceFile(filePath) {
  if (!filePath) return false;
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return SOURCE_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

export function scanContent(content, filePath = "<unknown>") {
  if (!content || typeof content !== "string") return [];
  const findings = [
    ...scanFunctionLOC(content, filePath),
    ...scanArity(content),
    ...scanFlagArgs(content),
    ...scanSingleLetterNames(content),
    ...scanMagicNumbers(content)
  ];
  return findings.map(f => ({ ...f, file: filePath }));
}

export function summarise(findings) {
  if (!findings.length) return "no canon hits";
  const counts = {};
  for (const f of findings) counts[f.principle] = (counts[f.principle] ?? 0) + 1;
  return Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(", ");
}
