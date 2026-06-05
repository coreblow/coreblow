import { afterEach, describe, expect, it } from "vitest";
import { summarizeCaptureCoverage } from "./coverage.js";
import { clearCaptureStoreForTests, createCaptureSession, recordCaptureEvent } from "./store.sqlite.js";

describe("proxy capture coverage", () => {
  afterEach(() => clearCaptureStoreForTests());

  it("summarizes labels and observed hosts", () => {
    createCaptureSession({
      id: "s1",
      startedAt: 1,
      mode: "test",
      sourceScope: "coreblow",
      sourceProcess: "coreblow",
      dbPath: "/tmp/db.sqlite",
      blobDir: "/tmp/blobs",
    });
    recordCaptureEvent({
      sessionId: "s1",
      ts: 1,
      sourceScope: "coreblow",
      sourceProcess: "coreblow",
      protocol: "http",
      direction: "outbound",
      kind: "request",
      flowId: "f1",
      host: "api.example.com",
      metaJson: JSON.stringify({ provider: "openai", api: "responses", model: "gpt" }),
    });

    const summary = summarizeCaptureCoverage("s1");

    expect(summary.totalEvents).toBe(1);
    expect(summary.providers[0]).toEqual({ value: "openai", count: 1 });
    expect(summary.hosts[0]).toEqual({ value: "api.example.com", count: 1 });
  });
});
