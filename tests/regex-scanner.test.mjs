import { test } from "node:test";
import assert from "node:assert/strict";
import { isSourceFile, scanContent } from "../hooks/lib/regex-scanner.mjs";

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
