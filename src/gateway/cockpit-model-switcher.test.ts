import { beforeEach, describe, expect, it } from "vitest";
import { CockpitModelSwitcher } from "./cockpit-model-switcher.js";

describe("CockpitModelSwitcher", () => {
  let switcher: CockpitModelSwitcher;

  beforeEach(async () => {
    switcher = new CockpitModelSwitcher();
    await switcher.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(switcher.health().status).toBe("healthy");
    await switcher.stop();
    expect(switcher.health().status).toBe("down");
  });

  it("initializes with default local and cloud frontier models", () => {
    const models = switcher.listModels();
    expect(models.length).toBeGreaterThanOrEqual(4);

    const localModel = models.find((m) => m.tier === "local_edge");
    const cloudModel = models.find((m) => m.tier === "cloud_frontier");

    expect(localModel).toBeDefined();
    expect(cloudModel).toBeDefined();
    expect(switcher.getActiveModel().id).toBe("local/vllm-qwen");
  });

  it("switches active model dynamically and validates target exists", () => {
    const switched = switcher.setActiveModel("cloud/claude-3-7-sonnet");
    expect(switched.id).toBe("cloud/claude-3-7-sonnet");
    expect(switcher.getActiveModel().id).toBe("cloud/claude-3-7-sonnet");

    expect(() => switcher.setActiveModel("non-existent-model")).toThrow(/Not found/);
  });

  it("records turn usage, token burn, and calculates USD cost accurately", () => {
    switcher.setActiveModel("cloud/claude-3-7-sonnet");

    switcher.recordTurnUsage({
      modelId: "cloud/claude-3-7-sonnet",
      tokensIn: 10_000,
      tokensOut: 2_000,
      latencyMs: 800,
    });

    const metrics = switcher.getTelemetryMetrics();
    expect(metrics.activeModelId).toBe("cloud/claude-3-7-sonnet");
    expect(metrics.totalTokensIn).toBe(10_000);
    expect(metrics.totalTokensOut).toBe(2_000);
    expect(metrics.totalCalls).toBe(1);
    expect(metrics.averageLatencyMs).toBe(800);
    // Cost: 10000 * 0.000003 + 2000 * 0.000015 = 0.03 + 0.03 = 0.06
    expect(metrics.estimatedCostUsd).toBe(0.06);
  });

  it("tracks Real-Time Factor (RTF) metrics for local Apple Silicon speech synthesis", () => {
    switcher.setActiveModel("local/mlx-tts");

    switcher.recordTurnUsage({
      modelId: "local/mlx-tts",
      tokensIn: 50,
      tokensOut: 200,
      latencyMs: 120,
      rtf: 0.32, // RTF <= 0.4 target
    });

    const metrics = switcher.getTelemetryMetrics();
    expect(metrics.activeModelId).toBe("local/mlx-tts");
    expect(metrics.measuredRtf).toBe(0.32);
    expect(metrics.estimatedCostUsd).toBe(0); // Zero cost local edge
  });

  it("notifies telemetry listeners on model switch and turn recording", () => {
    let callCount = 0;
    const unsubscribe = switcher.subscribe(() => {
      callCount += 1;
    });

    switcher.setActiveModel("cloud/gemini-2-5-pro");
    switcher.recordTurnUsage({
      modelId: "cloud/gemini-2-5-pro",
      tokensIn: 500,
      tokensOut: 100,
      latencyMs: 400,
    });

    expect(callCount).toBeGreaterThanOrEqual(3); // Initial + switch + turn
    unsubscribe();
  });
});
