import { describe, expect, it } from "vitest";
import { createCoreBlowChannelMcpServer } from "./channel-server.js";
import { ChannelPermissionRequestSchema } from "./channel-shared.js";
import { getChannelMcpCapabilities } from "./channel-tools.js";

describe("MCP channel schemas and capabilities", () => {
  it("uses static literal for ChannelPermissionRequestSchema method", () => {
    expect(ChannelPermissionRequestSchema.shape.method.value).toBe(
      "notifications/coreblow/channel/permission_request",
    );

    const parsed = ChannelPermissionRequestSchema.parse({
      method: "notifications/coreblow/channel/permission_request",
      params: {
        request_id: "req-1",
        tool_name: "bash",
        description: "run tests",
        input_preview: '{"cmd":"pnpm test"}',
      },
    });
    expect(parsed.params.request_id).toBe("req-1");
  });

  it("exposes only coreblow/channel experimental capabilities with zero legacy brands", () => {
    const caps = getChannelMcpCapabilities("on");
    expect(caps?.experimental).toEqual({
      "coreblow/channel": {},
      "coreblow/channel/permission": {},
    });
    const serialized = JSON.stringify(caps);
    expect(serialized).not.toContain("claude");
  });

  it("createCoreBlowChannelMcpServer initializes cleanly with zero schema error", async () => {
    const serverHarness = await createCoreBlowChannelMcpServer({
      channelMode: "on",
    });
    expect(serverHarness.server).toBeDefined();
    expect(serverHarness.bridge).toBeDefined();
    await serverHarness.close();
  });
});
