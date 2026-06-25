import { describe, expect, it } from "vitest";
import { runTasksWithConcurrency } from "./concurrency-runtime.js";
import { createDedupeCache } from "./dedupe-runtime.js";
import { parseFiniteNumber } from "./number-runtime.js";

describe("plugin SDK runtime utility facades", () => {
  it("exposes concurrency, dedupe, and numeric helpers", async () => {
    await expect(
      runTasksWithConcurrency({ tasks: [async () => 1, async () => 2], limit: 1 }),
    ).resolves.toMatchObject({ results: [1, 2], hasError: false });
    expect(createDedupeCache).toBeTypeOf("function");
    expect(parseFiniteNumber("42")).toBe(42);
  });
});
