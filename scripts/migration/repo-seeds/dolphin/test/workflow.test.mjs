import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowPlan, WorkflowStep } from "../src/workflow.mjs";

test("valid workflow plan passes", () => {
  const plan = new WorkflowPlan([new WorkflowStep({ id: "one", command: "coreblow doctor" })]);
  assert.deepEqual(plan.validate(), { ok: true, errors: [] });
});

test("duplicate ids fail validation", () => {
  const plan = new WorkflowPlan([
    { id: "one", command: "a" },
    { id: "one", command: "b" },
  ]);
  assert.equal(plan.validate().ok, false);
});
