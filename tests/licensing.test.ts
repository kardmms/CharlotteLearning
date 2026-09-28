import test from "node:test";
import assert from "node:assert/strict";
import { licenseKeyHash } from "../src/lib/licensing.ts";

test("license keys match regardless of case and do not store the key itself", () => {
  const hash = licenseKeyHash("Teacher-2026");
  assert.equal(hash, licenseKeyHash("teacher-2026"));
  assert.notEqual(hash, "Teacher-2026");
  assert.notEqual(hash, licenseKeyHash("teacher-2027"));
});
