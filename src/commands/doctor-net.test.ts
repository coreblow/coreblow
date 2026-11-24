import { describe, expect, it, vi } from "vitest";
import {
  calculateLatencyStats,
  formatDoctorNetOutput,
  probeGatewayLatency,
  runDoctorNetProbe,
  type DoctorNetResult,
} from "./doctor-net.js";

describe("doctor-net latency calculations", () => {
  it("calculates accurate min, median, p95, max, and mean ms", () => {
    const latencies = [1.2, 2.5, 3.1, 4.8, 10.0];
    const stats = calculateLatencyStats(latencies);

    expect(stats).not.toBeNull();
    expect(stats?.min).toBe(1.2);
    expect(stats?.max).toBe(10.0);
    expect(stats?.median).toBe(3.1);
    expect(stats?.mean).toBe(4.32);
    expect(stats?.p95).toBe(10.0);
  });

  it("handles even number of latency samples for median", () => {
    const latencies = [2.0, 4.0, 6.0, 8.0];
    const stats = calculateLatencyStats(latencies);

    expect(stats).not.toBeNull();
    expect(stats?.median).toBe(5.0);
  });

  it("returns null for empty latencies array", () => {
    expect(calculateLatencyStats([])).toBeNull();
  });
});

describe("probeGatewayLatency", () => {
  it("probes successfully and returns latency metrics", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      // Simulate minor network delay
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        json: async () => ({ status: "ok" }),
      };
    });

    const result = await probeGatewayLatency({
      url: "http://127.0.0.1:18789/health",
      samples: 3,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.targetUrl).toBe("http://127.0.0.1:18789/health");
    expect(result.reachable).toBe(true);
    expect(result.totalSamples).toBe(3);
    expect(result.successfulSamples).toBe(3);
    expect(result.failedSamples).toBe(0);
    expect(result.statusCode).toBe(200);
    expect(result.rttMs).not.toBeNull();
    expect(result.samples.length).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("records unreachable diagnostic when gateway connection fails", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:18789");
    });

    const result = await probeGatewayLatency({
      url: "http://127.0.0.1:18789/health",
      samples: 2,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.reachable).toBe(false);
    expect(result.successfulSamples).toBe(0);
    expect(result.failedSamples).toBe(2);
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.rttMs).toBeNull();
  });
});

describe("runDoctorNetProbe formatting & output", () => {
  it("formats text diagnostics correctly for both reachable and unreachable cases", () => {
    const reachableResult: DoctorNetResult = {
      targetUrl: "http://127.0.0.1:18789/health",
      reachable: true,
      totalSamples: 5,
      successfulSamples: 5,
      failedSamples: 0,
      statusCode: 200,
      rttMs: { min: 1.1, median: 2.2, p95: 3.5, max: 3.5, mean: 2.3 },
      samples: [],
    };

    const textOutput = formatDoctorNetOutput(reachableResult);
    expect(textOutput).toContain("CoreBlow Gateway Latency & Health Probe");
    expect(textOutput).toContain("OK (HTTP 200)");
    expect(textOutput).toContain("Min:      1.10 ms");

    const unreachableResult: DoctorNetResult = {
      targetUrl: "http://127.0.0.1:18789/health",
      reachable: false,
      totalSamples: 3,
      successfulSamples: 0,
      failedSamples: 3,
      rttMs: null,
      samples: [],
      error: "connect ECONNREFUSED",
    };

    const unreachableText = formatDoctorNetOutput(unreachableResult);
    expect(unreachableText).toContain("UNREACHABLE");
    expect(unreachableText).toContain("coreblow gateway");
  });

  it("outputs JSON when options.json is true", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => ({
      status: 200,
      ok: true,
      statusText: "OK",
    }));

    const logs: string[] = [];
    const mockRuntime = {
      log: vi.fn((msg: string) => logs.push(msg)),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await runDoctorNetProbe(mockRuntime as any, {
      url: "http://127.0.0.1:18789/health",
      samples: 2,
      json: true,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(logs.length).toBe(1);
    const parsed = JSON.parse(logs[0]);
    expect(parsed.reachable).toBe(true);
    expect(parsed.targetUrl).toBe("http://127.0.0.1:18789/health");
  });
});
