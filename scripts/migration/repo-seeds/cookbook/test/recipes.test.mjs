import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createReply } from "../examples/hello-agent/index.mjs";

test("hello-agent recipe exists", () => {
  assert.equal(existsSync("recipes/hello-agent.md"), true);
});

test("hello-agent returns structured CoreBlow reply", () => {
  assert.deepEqual(createReply("hello"), {
    product: "CoreBlow",
    ok: true,
    reply: "CoreBlow received: hello",
  });
});
