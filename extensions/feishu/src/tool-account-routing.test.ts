import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CoreBlowPluginApi } from "../runtime-api.js";
import { createToolFactoryHarness } from "./tool-factory-test-harness.js";

const createFeishuClientMock = vi.fn((account: { appId?: string } | undefined) => ({
  __appId: account?.appId,
}));

vi.mock("./client.js", () => ({
  createFeishuClient: (account: { appId?: string } | undefined) => createFeishuClientMock(account),
}));

let registerFeishuBitableTools: typeof import("./bitable.js").registerFeishuBitableTools;
let registerFeishuDriveTools: typeof import("./drive.js").registerFeishuDriveTools;
let registerFeishuPermTools: typeof import("./perm.js").registerFeishuPermTools;
let registerFeishuWikiTools: typeof import("./wiki.js").registerFeishuWikiTools;

function createConfig(params: {
  toolsA?: { wiki?: boolean; drive?: boolean; perm?: boolean };
  toolsB?: { wiki?: boolean; drive?: boolean; perm?: boolean };
  defaultAccount?: string;
}): CoreBlowPluginApi["config"] {
  return {
    channels: {
      feishu: {
        enabled: true,
        defaultAccount: params.defaultAccount,
        accounts: {
          a: {
            appId: "app-a",
            appSecret: "sec-a", // pragma: allowlist secret
            tools: params.toolsA,
          },
          b: {
            appId: "app-b",
            appSecret: "sec-b", // pragma: allowlist secret
            tools: params.toolsB,
          },
        },
      },
    },
  } as CoreBlowPluginApi["config"];
}

describe("feishu tool account routing", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ registerFeishuBitableTools, registerFeishuDriveTools, registerFeishuPermTools } =
      await import("./bitable.js").then(async ({ registerFeishuBitableTools }) => ({
        registerFeishuBitableTools,
        ...(await import("./drive.js")),
        ...(await import("./perm.js")),
        ...(await import("./wiki.js")),
      })));
    ({ registerFeishuWikiTools } = await import("./wiki.js"));
    vi.clearAllMocks();
  });

  test("wiki tool registers when first account disables it and routes to agentAccountId", async () => {
    const { api, resolveTool } = createToolFactoryHarness(
      createConfig({
        toolsA: { wiki: false },
        toolsB: { wiki: true },
      }),
    );
    registerFeishuWikiTools(api);

    const tool = resolveTool("feishu_wiki", { agentAccountId: "b" });
    await tool.execute("call", { action: "search" });

    expect(createFeishuClientMock.mock.calls.at(-1)?.[0]?.appId).toBe("app-b");
  });

  test("wiki tool prefers configured defaultAccount over inherited default account context", async () => {
    const { api, resolveTool } = createToolFactoryHarness(
      createConfig({
        defaultAccount: "b",
        toolsA: { wiki: true },
        toolsB: { wiki: true },
      }),
    );
    registerFeishuWikiTools(api);

    const tool = resolveTool("feishu_wiki", { agentAccountId: "a" });
    await tool.execute("call", { action: "search" });

    expect(createFeishuClientMock.mock.calls.at(-1)?.[0]?.appId).toBe("app-b");
  });

  test("drive and permission tools can route to a non-first enabled account", async () => {
    const { api, resolveTool } = createToolFactoryHarness(
      createConfig({
        toolsA: { drive: false, perm: false },
        toolsB: { drive: true, perm: true },
      }),
    );
    registerFeishuDriveTools(api);
    registerFeishuPermTools(api);

    await resolveTool("feishu_drive", { agentAccountId: "b" }).execute("drive", {
      action: "unknown_action",
    });
    await resolveTool("feishu_perm", { agentAccountId: "b" }).execute("perm", {
      action: "unknown_action",
    });

    expect(createFeishuClientMock.mock.calls.at(-2)?.[0]?.appId).toBe("app-b");
    expect(createFeishuClientMock.mock.calls.at(-1)?.[0]?.appId).toBe("app-b");
  });

  test("bitable tool routes to agentAccountId and allows explicit accountId override", async () => {
    const { api, resolveTool } = createToolFactoryHarness(createConfig({}));
    registerFeishuBitableTools(api);

    const tool = resolveTool("feishu_bitable_get_meta", { agentAccountId: "b" });
    await tool.execute("call-ctx", { url: "invalid-url" });
    await tool.execute("call-override", { url: "invalid-url", accountId: "a" });

    expect(createFeishuClientMock.mock.calls[0]?.[0]?.appId).toBe("app-b");
    expect(createFeishuClientMock.mock.calls[1]?.[0]?.appId).toBe("app-a");
  });

  test("falls back to the configured Feishu default selection when agentAccountId is not a real account", async () => {
    const { api, resolveTool } = createToolFactoryHarness(
      createConfig({
        toolsA: { wiki: true },
        toolsB: { wiki: true },
      }),
    );
    registerFeishuWikiTools(api);

    const tool = resolveTool("feishu_wiki", { agentAccountId: "agent-spawner" });
    await tool.execute("call", { action: "search" });

    expect(createFeishuClientMock.mock.calls.at(-1)?.[0]?.appId).toBe("app-a");
  });
});
