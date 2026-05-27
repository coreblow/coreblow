import { describe, expect, it, vi } from "vitest";
import { nodeHandlers } from "./nodes.js";

const handleNodeEventMock = vi.hoisted(() =>
  vi.fn(async (_context: unknown, _nodeId: string, _event: unknown, opts?: unknown) => ({
    ok: true,
    opts,
  })),
);

vi.mock("../server-node-events.js", () => ({
  handleNodeEvent: handleNodeEventMock,
}));

describe("node.event authorization wiring", () => {
  it("forwards registry authorization and the caller connection identity", async () => {
    const authorizeSystemRunEvent = vi.fn(
      (_params: {
        nodeId: string;
        connId?: string;
        runId?: string;
        sessionKey: string;
        terminal: boolean;
      }) => true,
    );
    const respond = vi.fn();
    const context = {
      deps: {},
      broadcast: vi.fn(),
      nodeSendToSession: vi.fn(),
      nodeSubscribe: vi.fn(),
      nodeUnsubscribe: vi.fn(),
      broadcastVoiceWakeChanged: vi.fn(),
      addChatRun: vi.fn(),
      removeChatRun: vi.fn(),
      chatAbortControllers: new Map(),
      chatAbortedRuns: new Map(),
      chatRunBuffers: new Map(),
      chatDeltaSentAt: new Map(),
      dedupe: new Map(),
      agentRunSeq: new Map(),
      getHealthCache: vi.fn(() => null),
      refreshHealthSnapshot: vi.fn(),
      loadGatewayModelCatalog: vi.fn(),
      nodeRegistry: { authorizeSystemRunEvent },
      logGateway: { warn: vi.fn() },
    };

    await nodeHandlers["node.event"]({
      req: { type: "req", id: "req-node-event", method: "node.event" },
      params: { event: "exec.finished", payloadJSON: '{"runId":"run-1"}' },
      respond,
      context: context as never,
      client: {
        connId: "conn-1",
        connect: { device: { id: "node-1" }, client: { id: "node-host" } },
      } as never,
      isWebchatConnect: () => false,
    });

    const [nodeContext, nodeId, event, opts] = handleNodeEventMock.mock.calls[0] ?? [];
    expect(nodeId).toBe("node-1");
    expect(event).toEqual({ event: "exec.finished", payloadJSON: '{"runId":"run-1"}' });
    expect(opts).toEqual({ connId: "conn-1" });

    const authorize = (nodeContext as { authorizeNodeSystemRunEvent: typeof authorizeSystemRunEvent })
      .authorizeNodeSystemRunEvent;
    expect(
      authorize({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "run-1",
        sessionKey: "agent:main:main",
        terminal: true,
      }),
    ).toBe(true);
    expect(authorizeSystemRunEvent).toHaveBeenCalledWith({
      nodeId: "node-1",
      connId: "conn-1",
      runId: "run-1",
      sessionKey: "agent:main:main",
      terminal: true,
    });
    expect(respond).toHaveBeenCalledWith(true, { ok: true, opts: { connId: "conn-1" } }, undefined);
  });
});
