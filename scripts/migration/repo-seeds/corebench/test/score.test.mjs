import assert from "node:assert/strict";
import { scoreRun } from "../src/score.mjs";

assert.equal(scoreRun({ correctness: 1, reliability: 1, latency: 1 }), 1);
assert.equal(scoreRun({ correctness: 1, reliability: 0, latency: 0 }), 0.5);
assert.equal(scoreRun({ correctness: 2, reliability: -1, latency: Number.NaN }), 0.5);
