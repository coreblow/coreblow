import { beforeEach, describe, expect, it } from "vitest";
import { MlxTtsBenchmarkGuard } from "./mlx-tts-benchmark-guard.js";

describe("MlxTtsBenchmarkGuard", () => {
  let guard: MlxTtsBenchmarkGuard;

  beforeEach(async () => {
    guard = new MlxTtsBenchmarkGuard({
      maxTargetRtf: 0.40,
      consecutiveSlowThreshold: 3,
    });
    await guard.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(guard.health().status).toBe("healthy");
    await guard.stop();
    expect(guard.health().status).toBe("down");
  });

  it("accurately records samples and computes Real-Time Factor (RTF)", () => {
    // 1000ms of audio synthesized in 350ms -> RTF = 0.35
    const sample = guard.recordSample({
      audioDurationMs: 1000,
      synthesisTimeMs: 350,
      textLength: 50,
    });

    expect(sample.rtf).toBe(0.35);
    expect(sample.engine).toBe("apple-silicon-mlx");
    expect(guard.getAverageRtf()).toBe(0.35);
    expect(guard.isCertifiedRtfTargetMet()).toBe(true);
  });

  it("certifies RTF <= 0.4 target on Apple Silicon M-series hardware profile", () => {
    // Record 5 fast samples simulating Apple Silicon MLX performance
    const timings = [
      { audioMs: 2000, synthMs: 600 }, // 0.30
      { audioMs: 1500, synthMs: 480 }, // 0.32
      { audioMs: 3000, synthMs: 1050 }, // 0.35
      { audioMs: 1000, synthMs: 380 }, // 0.38
      { audioMs: 2500, synthMs: 750 }, // 0.30
    ];

    for (const t of timings) {
      guard.recordSample({
        audioDurationMs: t.audioMs,
        synthesisTimeMs: t.synthMs,
        textLength: 100,
      });
    }

    expect(guard.getAverageRtf()).toBeLessThanOrEqual(0.40);
    expect(guard.isCertifiedRtfTargetMet()).toBe(true);
    expect(guard.resolveRecommendedEngine()).toBe("apple-silicon-mlx");
  });

  it("triggers automatic fallback when thermal throttling or slow performance persists (>= 3 consecutive)", () => {
    // Initial fast sample
    guard.recordSample({ audioDurationMs: 1000, synthesisTimeMs: 300, textLength: 50 });
    expect(guard.resolveRecommendedEngine()).toBe("apple-silicon-mlx");

    // 3 consecutive slow/throttled samples (RTF > 0.40 or thermalThrottled = true)
    guard.recordSample({ audioDurationMs: 1000, synthesisTimeMs: 600, textLength: 50 }); // 0.60
    guard.recordSample({ audioDurationMs: 1000, synthesisTimeMs: 700, textLength: 50, thermalThrottled: true });
    guard.recordSample({ audioDurationMs: 1000, synthesisTimeMs: 650, textLength: 50 });

    expect(guard.isCertifiedRtfTargetMet()).toBe(false);
    expect(guard.health().status).toBe("degraded");
    expect(guard.resolveRecommendedEngine()).toBe("cloud-fallback");

    // Recovers after reset
    guard.resetFallback();
    expect(guard.resolveRecommendedEngine()).toBe("apple-silicon-mlx");
  });
});
