/**
 * tests/bench/circuit-breaker.bench.ts
 *
 * Level 4 — Performance Parity Benchmarks
 * Mengukur overhead CircuitBreaker per-call.
 * Target: < 0.05ms overhead per execute() call.
 */
import { bench, describe } from "vitest";
import { CircuitBreaker } from "../../src/infra/circuit-breaker.js";

const cb = new CircuitBreaker();
const noopFn = async () => "ok";

describe("CircuitBreaker.execute", () => {
  bench("closed circuit — pass-through (no overhead)", async () => {
    await cb.execute("bench-closed", noopFn);
  });

  bench("closed circuit — 10 concurrent keys", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        cb.execute(`bench-key-${i}`, noopFn),
      ),
    );
  });

  bench("getState — known key", () => {
    cb.getState("bench-closed");
  });

  bench("getStats — known key", () => {
    cb.getStats("bench-closed");
  });

  bench("getState — unknown key (worst case lookup)", () => {
    cb.getState("never-executed-key-xyz");
  });
});
