import assert from "node:assert/strict";
import { createPatchPlan } from "../src/plan.mjs";

assert.deepEqual(createPatchPlan({ title: " Fix CI ", risk: "low" }).gates, ["targeted-test"]);
assert.deepEqual(createPatchPlan({ risk: "high" }).gates, [
  "targeted-test",
  "pnpm check",
  "pnpm build",
  "affected-ci",
]);
assert.equal(createPatchPlan({ risk: "unknown" }).risk, "medium");
