import { describe, expect, it } from "vitest";
import { buildTrajectoryRunMetadata } from "./metadata.js";

describe("trajectory metadata", () => {
  it("captures CoreBlow harness metadata", () => {
    const metadata = buildTrajectoryRunMetadata({
      env: { HOME: "/Users/tester", COREBLOW_STATE_DIR: "/Users/tester/.coreblow" },
      config: {},
      workspaceDir: "/Users/tester/project",
      timeoutMs: 1000,
      provider: "openai",
      modelId: "gpt",
    });

    expect((metadata.harness as { type?: string }).type).toBe("coreblow");
    expect((metadata.model as { provider?: string }).provider).toBe("openai");
  });
});
