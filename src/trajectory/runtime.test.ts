import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { QueuedFileWriter } from "../agents/queued-file-writer.js";
import { createTrajectoryRuntimeRecorder } from "./runtime.js";

describe("trajectory runtime", () => {
  it("records CoreBlow trajectory events", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-trajectory-runtime-"));
    const sessionFile = path.join(dir, "session.jsonl");
    const lines: string[] = [];
    const writer: QueuedFileWriter & { flush: () => Promise<void> } = {
      filePath: path.join(dir, "runtime.jsonl"),
      write: (line) => {
        lines.push(line);
      },
      flush: async () => {},
    };
    const recorder = createTrajectoryRuntimeRecorder({
      sessionId: "session-1",
      sessionFile,
      workspaceDir: dir,
      provider: "openai",
      modelId: "gpt",
      writer,
    });

    expect(recorder).not.toBeNull();
    if (!recorder) {
      throw new Error("Expected trajectory recorder");
    }
    expect(recorder.enabled).toBe(true);
    recorder.recordEvent("run.started", { token: "sk-test-secret-token" });
    await recorder.flush();

    const content = lines.join("");
    expect(content).toContain("coreblow-trajectory");
    expect(content).not.toContain("sk-test-secret-token");
  });
});
