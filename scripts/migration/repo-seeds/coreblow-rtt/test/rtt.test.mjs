import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSample, summarizeSamples } from "../scripts/rtt.mjs";

test("normalizes sample fields", () => {
  assert.deepEqual(normalizeSample({ release: " 1.0.0 ", milliseconds: -4 }), {
    release: "1.0.0",
    region: "local",
    milliseconds: 0,
  });
});

test("summarizes samples", () => {
  assert.deepEqual(summarizeSamples([{ milliseconds: 10 }, { milliseconds: 20 }]), {
    count: 2,
    averageMilliseconds: 15,
  });
});
