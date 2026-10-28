import { beforeEach, describe, expect, it } from "vitest";
import { HybridSovereignRouter } from "./hybrid-sovereign-router.js";

describe("HybridSovereignRouter", () => {
  let router: HybridSovereignRouter;

  beforeEach(async () => {
    router = new HybridSovereignRouter({
      confidenceThreshold: 0.75,
      failureThresholdForFallback: 3,
    });
    await router.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(router.health().status).toBe("healthy");
    await router.stop();
    expect(router.health().status).toBe("down");
  });

  it("guarantees SOVEREIGN_LOCAL_ONLY payloads are strictly routed locally", () => {
    const decision = router.route({
      prompt: "Analyze classified financial balance sheet",
      classification: "SOVEREIGN_LOCAL_ONLY",
      complexity: "reasoning_heavy", // even with heavy complexity
    });

    expect(decision.targetTier).toBe("local_edge");
    expect(decision.selectedProvider).toBe("vllm");
    expect(decision.privacyEnforced).toBe(true);
    expect(decision.reason).toContain("Strict SOVEREIGN_LOCAL_ONLY");
  });

  it("routes high reasoning complexity queries to cloud frontier when allowed", () => {
    const decision = router.route({
      prompt: "Architect microservices topology",
      classification: "INTERNAL",
      complexity: "complex",
      confidenceScore: 0.4,
    });

    expect(decision.targetTier).toBe("cloud_frontier");
    expect(decision.selectedProvider).toBe("anthropic");
    expect(decision.privacyEnforced).toBe(false);
  });

  it("optimizes simple or high confidence queries to zero-cost local edge", () => {
    const decisionSimple = router.route({
      prompt: "Format this markdown list",
      classification: "PUBLIC",
      complexity: "simple",
    });
    expect(decisionSimple.targetTier).toBe("local_edge");

    const decisionHighConf = router.route({
      prompt: "Translate greeting to Spanish",
      classification: "PUBLIC",
      confidenceScore: 0.85, // >= 0.75
    });
    expect(decisionHighConf.targetTier).toBe("local_edge");
  });

  it("automatically fails over to local edge when cloud provider trips circuit breaker (>= 3 failures)", () => {
    const query = {
      prompt: "Heavy multi-step analysis",
      classification: "PUBLIC" as const,
      complexity: "complex" as const,
    };

    // Initially routes to cloud
    expect(router.route(query).targetTier).toBe("cloud_frontier");

    // Simulate 3 consecutive cloud provider failures (e.g. rate limit 429 or 503)
    router.recordProviderFailure("anthropic");
    router.recordProviderFailure("anthropic");
    router.recordProviderFailure("anthropic");

    expect(router.isCircuitBreakerTripped("anthropic")).toBe(true);
    expect(router.health().status).toBe("degraded");

    // Seamless failover to local edge with zero crashes
    const fallbackDecision = router.route(query);
    expect(fallbackDecision.targetTier).toBe("local_edge");
    expect(fallbackDecision.circuitBreakerActive).toBe(true);
    expect(fallbackDecision.reason).toContain("circuit breaker tripped");

    // Provider recovers
    router.recordProviderSuccess("anthropic");
    expect(router.isCircuitBreakerTripped("anthropic")).toBe(false);
    expect(router.route(query).targetTier).toBe("cloud_frontier");
  });
});
