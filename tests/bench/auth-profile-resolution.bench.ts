/**
 * tests/bench/auth-profile-resolution.bench.ts
 *
 * Level 4 — Performance Parity Benchmarks
 * Mengukur throughput operasi kritis auth-profile.
 * Target: setiap operasi < 1ms (pure in-memory logic).
 */
import { bench, describe } from "vitest";
import type { AuthProfileStore } from "../../src/agents/auth-profiles/types.js";
import {
  resolveAuthProfileOrder,
} from "../../src/agents/auth-profiles/order.js";
import {
  calculateAuthProfileCooldownMs,
} from "../../src/agents/auth-profiles/usage.js";

// ─── fixtures ───────────────────────────────────────────────────────────────

function makeStore(profileCount: number): AuthProfileStore {
  const profiles: AuthProfileStore["profiles"] = {};
  const providers = ["openai", "anthropic", "openrouter", "google", "groq"];
  for (let i = 0; i < profileCount; i++) {
    const provider = providers[i % providers.length];
    profiles[`${provider}:profile-${i}`] = {
      type: "api_key",
      provider,
      key: `sk-test-${i}`,
    };
  }
  return { version: 1, profiles };
}

const STORE_5   = makeStore(5);
const STORE_20  = makeStore(20);
const STORE_100 = makeStore(100);

// ─── resolveAuthProfileOrder benchmarks ─────────────────────────────────────

describe("resolveAuthProfileOrder", () => {
  bench("5 profiles — typical single-agent", () => {
    resolveAuthProfileOrder({ store: STORE_5, config: {} });
  });

  bench("20 profiles — multi-provider", () => {
    resolveAuthProfileOrder({ store: STORE_20, config: {} });
  });

  bench("100 profiles — large enterprise store", () => {
    resolveAuthProfileOrder({ store: STORE_100, config: {} });
  });

  bench("100 profiles — with explicit order config", () => {
    resolveAuthProfileOrder({
      store: STORE_100,
      config: {
        authProfileOrder: ["openai:profile-0", "anthropic:profile-1", "groq:profile-2"],
      },
    });
  });
});

// ─── calculateAuthProfileCooldownMs benchmarks ──────────────────────────────

describe("calculateAuthProfileCooldownMs", () => {
  bench("errorCount=1 (first failure)", () => {
    calculateAuthProfileCooldownMs(1);
  });

  bench("errorCount=5 (repeated failures)", () => {
    calculateAuthProfileCooldownMs(5);
  });

  bench("errorCount=100 (at cap)", () => {
    calculateAuthProfileCooldownMs(100);
  });
});
