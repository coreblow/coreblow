import assert from "node:assert/strict";
import { classifyItem } from "../src/classifier.mjs";

const now = new Date("2026-05-19T00:00:00Z");

assert.deepEqual(classifyItem({ labels: ["security"] }, now), {
  action: "escalate",
  reason: "security label present",
});
assert.equal(classifyItem({ labels: [], updatedAt: "2026-04-01T00:00:00Z" }, now).action, "review-stale");
assert.equal(classifyItem({ labels: [], updatedAt: "2026-05-18T00:00:00Z" }, now).action, "monitor");
