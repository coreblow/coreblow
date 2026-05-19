import assert from "node:assert/strict";
import { createRunPlan } from "../src/plan.mjs";

const plan = createRunPlan({ steps: ["install", "test"] });

assert.equal(plan.packageManager, "pnpm");
assert.deepEqual(plan.commands, ["pnpm install --frozen-lockfile", "pnpm test"]);
assert.throws(() => createRunPlan({ steps: ["publish"] }), /unsupported steps/);
