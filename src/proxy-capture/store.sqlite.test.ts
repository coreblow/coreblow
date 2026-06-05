import { afterEach, describe, expect, it } from "vitest";
import {
  clearCaptureStoreForTests,
  createCaptureSession,
  listCaptureSessionSummaries,
  queryCapturePreset,
  recordCaptureEvent,
} from "./store.sqlite.js";

describe("proxy capture store", () => {
  afterEach(() => clearCaptureStoreForTests());

  it("stores sessions and query rows", () => {
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
      ts: 2,
      sourceScope: "coreblow",
      sourceProcess: "coreblow",
      protocol: "http",
      direction: "outbound",
      kind: "error",
      flowId: "f1",
      status: 500,
      errorText: "boom",
    });

    expect(listCaptureSessionSummaries()[0]?.eventCount).toBe(1);
    expect(queryCapturePreset("s1", "error-bursts")[0]).toMatchObject({ status: 500 });
  });
});
