#!/usr/bin/env node
import { WorkflowPlan } from "./workflow.mjs";

const plan = new WorkflowPlan([
  { id: "health", command: "coreblow doctor", inputs: { surface: "gateway" } },
]);

const result = plan.validate();
console.log(JSON.stringify({ name: "dolphin", ...result }, null, 2));
process.exit(result.ok ? 0 : 1);
