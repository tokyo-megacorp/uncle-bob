import { test } from "node:test";
import assert from "node:assert/strict";
import { isSourceFile, scanContent } from "../hooks/scripts/lib/regex-scanner.mjs";

test("isSourceFile: .json returns false", () => {
  assert.equal(isSourceFile("/path/to/foo.json"), false);
});

test("isSourceFile: .ts returns true", () => {
  assert.equal(isSourceFile("/path/to/foo.ts"), true);
});

test("isSourceFile: no extension returns false", () => {
  assert.equal(isSourceFile("/path/to/foo"), false);
});

test("isSourceFile: undefined returns false", () => {
  assert.equal(isSourceFile(undefined), false);
});

test("isSourceFile: uppercase extension is case-insensitive", () => {
  assert.equal(isSourceFile("/PATH/TO/FOO.TS"), true);
});

test("scanMagicNumbers: hyphenated identifier 'gpt-5' is not flagged", () => {
  const code = `const model = "gpt-5";\n`;
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.equal(hits.length, 0, "gpt-5 inside string must not trigger");
});

test("scanMagicNumbers: bare hyphenated identifier (unquoted) is not flagged", () => {
  const code = `function run() { return foo-5; }\n`;
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.equal(hits.length, 0, "foo-5 as a bare identifier must not trigger");
});

test("scanMagicNumbers: sha-256, claude-4-7, http-1, es-256 are not flagged", () => {
  const names = ["sha-256", "claude-4-7", "http-1", "es-256"];
  for (const name of names) {
    const code = `const n = "${name}";\n`;
    const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
    assert.equal(hits.length, 0, `"${name}" must not trigger magic-number`);
  }
});

test("scanMagicNumbers: number inside double-quoted string is skipped", () => {
  const code = `const msg = "retry 42 times";\n`;
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.equal(hits.length, 0, "number inside string literal must be skipped");
});

test("scanMagicNumbers: number inside single-quoted string is skipped", () => {
  const code = `const msg = 'retry 42 times';\n`;
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.equal(hits.length, 0, "number inside single-quoted literal must be skipped");
});

test("scanMagicNumbers: number inside backtick template is skipped", () => {
  const code = "const msg = `retry 42 times`;\n";
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.equal(hits.length, 0, "number inside backtick literal must be skipped");
});

test("scanMagicNumbers: bare magic number outside string IS flagged", () => {
  const code = `function retry() { for (let i = 0; i < 42; i++) {} }\n`;
  const hits = scanContent(code, "x.ts").filter(h => h.principle === "SearchableNames");
  assert.ok(hits.length >= 1, "bare 42 must still be flagged");
});

test("integration: scanContent called with json path produces hits, but hook gate prevents it", () => {
  // Build a JSON-like content with magic numbers that MAGIC_NUMBER regex would flag
  const jsonContent = Array.from({ length: 60 }, (_, i) => `  "value${i}": ${i + 2}`).join(",\n");

  // isSourceFile should return false for .json — gate prevents scan
  assert.equal(isSourceFile("x.json"), false);

  // But if we bypass the gate and call scanContent directly, hits exist
  const hits = scanContent(jsonContent, "x.json");
  assert.ok(hits.length > 0, "direct scanContent call produces hits on magic numbers in JSON");

  // The hook gate (isSourceFile) ensures scanContent is never called for .json
  // so zero entries reach the grade-card — verified by the gate returning false above
});
