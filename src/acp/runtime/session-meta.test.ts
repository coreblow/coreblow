import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";

const hoisted = vi.hoisted(() => {
  const resolveAllAgentSessionStoreTargetsMock = vi.fn();
  const loadSessionStoreMock = vi.fn();
  return {
    resolveAllAgentSessionStoreTargetsMock,
    loadSessionStoreMock,
  };
});

vi.mock("../../config/sessions.js", async () => {
  const actual = await vi.importActual<typeof import("../../config/sessions.js")>(
    "../../config/sessions.js",
  );
  return {
    ...actual,
    resolveAllAgentSessionStoreTargets: (cfg: CoreBlowConfig, opts: unknown) =>
      hoisted.resolveAllAgentSessionStoreTargetsMock(cfg, opts),
    loadSessionStore: (storePath: string) => hoisted.loadSessionStoreMock(storePath),
  };
});

let listAcpSessionEntries: typeof import("./session-meta.js").listAcpSessionEntries;

describe("listAcpSessionEntries", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ listAcpSessionEntries } = await import("./session-meta.js"));
    vi.clearAllMocks();
  });

  it("reads ACP sessions from resolved configured store targets", async () => {
    const cfg = {
      session: {
        store: "/custom/sessions/{agentId}.json",
      },
    } as CoreBlowConfig;
    hoisted.resolveAllAgentSessionStoreTargetsMock.mockResolvedValue([
      {
        agentId: "ops",
        storePath: "/custom/sessions/ops.json",
      },
    ]);
    hoisted.loadSessionStoreMock.mockReturnValue({
      "agent:ops:acp:s1": {
        updatedAt: 123,
        acp: {
          backend: "acpx",
          agent: "ops",
          mode: "persistent",
          state: "idle",
        },
      },
    });

    const entries = await listAcpSessionEntries({ cfg });

    expect(hoisted.resolveAllAgentSessionStoreTargetsMock).toHaveBeenCalledWith(cfg, undefined);
    expect(hoisted.loadSessionStoreMock).toHaveBeenCalledWith("/custom/sessions/ops.json");
    expect(entries).toEqual([
      expect.objectContaining({
        cfg,
        storePath: "/custom/sessions/ops.json",
        sessionKey: "agent:ops:acp:s1",
        storeSessionKey: "agent:ops:acp:s1",
      }),
    ]);
  });

  it("returns empty array when no store targets exist", async () => {
    hoisted.resolveAllAgentSessionStoreTargetsMock.mockResolvedValue([]);

    const entries = await listAcpSessionEntries({ cfg: {} as CoreBlowConfig });

    expect(entries).toEqual([]);
    expect(hoisted.loadSessionStoreMock).not.toHaveBeenCalled();
  });

  it("filters out non-ACP session keys", async () => {
    hoisted.resolveAllAgentSessionStoreTargetsMock.mockResolvedValue([
      { agentId: "main", storePath: "/sessions/main.json" },
    ]);
    hoisted.loadSessionStoreMock.mockReturnValue({
      "agent:main:telegram:123": {
        updatedAt: 100,
        // No acp field — not an ACP session
      },
      "agent:main:acp:s1": {
        updatedAt: 200,
        acp: {
          backend: "acpx",
          agent: "main",
          mode: "persistent",
          state: "idle",
        },
      },
    });

    const entries = await listAcpSessionEntries({ cfg: {} as CoreBlowConfig });

    expect(entries).toHaveLength(1);
    expect(entries[0].sessionKey).toBe("agent:main:acp:s1");
  });
});
