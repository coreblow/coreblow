import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { NodeRegistry, serializeEventPayload } from "./node-registry.js";
import type { GatewayWsClient } from "./server/ws-types.js";

function makeClient(
  connId: string,
  nodeId: string,
  sent: string[] = [],
  opts: {
    clientId?: string;
    platform?: string;
    caps?: string[];
    commands?: string[];
    permissions?: Record<string, boolean>;
    declaredCaps?: string[];
    declaredCommands?: string[];
    declaredPermissions?: Record<string, boolean>;
    socket?: GatewayWsClient["socket"];
  } = {},
): GatewayWsClient {
  return {
    connId,
    socket:
      opts.socket ??
      ({
        send(frame: unknown) {
          if (typeof frame === "string") {
            sent.push(frame);
          }
        },
      } as unknown as GatewayWsClient["socket"]),
    connect: {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        id: opts.clientId ?? "coreblow-macos",
        version: "1.0.0",
        platform: opts.platform ?? "darwin",
        mode: "node",
      },
      device: {
        id: nodeId,
        publicKey: "public-key",
        signature: "signature",
        signedAt: 1,
        nonce: "nonce",
      },
      caps: opts.caps ?? [],
      commands: opts.commands ?? [],
      permissions: opts.permissions,
      declaredCaps: opts.declaredCaps,
      declaredCommands: opts.declaredCommands,
      declaredPermissions: opts.declaredPermissions,
    } as unknown as GatewayWsClient["connect"],
  };
}

function makePingableSocket(emitPong: boolean) {
  const socket = new EventEmitter() as EventEmitter & {
    readyState: number;
    send: (frame: unknown) => void;
    ping: (data?: Buffer, mask?: boolean, cb?: (err?: Error) => void) => void;
  };
  socket.readyState = 1;
  socket.send = () => {};
  socket.ping = (_data, _mask, cb) => {
    cb?.();
    if (emitPong) {
      queueMicrotask(() => socket.emit("pong"));
    }
  };
  return socket;
}

describe("gateway/node-registry", () => {
  it("checks node websocket connectivity with ping/pong", async () => {
    const registry = new NodeRegistry();
    registry.register(
      makeClient("conn-1", "node-1", [], {
        socket: makePingableSocket(true) as unknown as GatewayWsClient["socket"],
      }),
      {},
    );

    await expect(registry.checkConnectivity("node-1", 50)).resolves.toEqual({ ok: true });
  });

  it("reports stale node websocket connectivity before invoke timeout", async () => {
    const registry = new NodeRegistry();
    registry.register(
      makeClient("conn-1", "node-1", [], {
        socket: makePingableSocket(false) as unknown as GatewayWsClient["socket"],
      }),
      {},
    );

    await expect(registry.checkConnectivity("node-1", 1)).resolves.toEqual({
      ok: false,
      error: { code: "TIMEOUT", message: "node connectivity probe timed out" },
    });
  });

  it("keeps a reconnected node when the old connection unregisters", async () => {
    const registry = new NodeRegistry();
    const oldFrames: string[] = [];
    registry.register(makeClient("conn-old", "node-1", oldFrames), {});
    const oldInvoke = registry.invoke({ nodeId: "node-1", command: "system.run", timeoutMs: 1_000 });
    const oldDisconnected = oldInvoke.catch((error: unknown) => error);
    const request = JSON.parse(oldFrames[0] ?? "{}") as { payload?: { id?: string } };
    const newSession = registry.register(makeClient("conn-new", "node-1"), {});

    expect(
      registry.handleInvokeResult({
        id: request.payload?.id ?? "",
        nodeId: "node-1",
        connId: "conn-new",
        ok: true,
      }),
    ).toBe(false);
    expect(registry.unregister("conn-old")).toBeNull();
    expect(registry.get("node-1")).toBe(newSession);
    await expect(oldDisconnected).resolves.toBeInstanceOf(Error);
  });

  it("matches system.run events to the issuing connection until terminal output", async () => {
    const registry = new NodeRegistry();
    const frames: string[] = [];
    registry.register(
      makeClient("conn-1", "node-1", frames, { clientId: "node-host", platform: "linux" }),
      {},
    );
    const invoke = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      params: { runId: "run-1", sessionKey: "agent:main:main" },
      timeoutMs: 1_000,
    });
    const request = JSON.parse(frames[0] ?? "{}") as { payload?: { id?: string } };

    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "run-1",
        sessionKey: "agent:main:main",
        terminal: false,
      }),
    ).toBe(true);
    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-other",
        runId: "run-1",
        sessionKey: "agent:main:main",
        terminal: false,
      }),
    ).toBe(false);

    registry.handleInvokeResult({
      id: request.payload?.id ?? "",
      nodeId: "node-1",
      connId: "conn-1",
      ok: true,
    });
    await expect(invoke).resolves.toEqual({
      ok: true,
      payload: undefined,
      payloadJSON: null,
      error: null,
    });
    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "run-1",
        sessionKey: "agent:main:main",
        terminal: true,
      }),
    ).toBe(true);
    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "run-1",
        sessionKey: "agent:main:main",
        terminal: false,
      }),
    ).toBe(false);
  });

  it("keeps no-timeout system.run event authorization after invoke timeout", async () => {
    vi.useFakeTimers();
    const registry = new NodeRegistry();
    try {
      registry.register(makeClient("conn-1", "node-1"), {});
      const invoke = registry.invoke({
        nodeId: "node-1",
        command: "system.run",
        params: { runId: "run-timeout", sessionKey: "agent:main:main", timeoutMs: 0 },
        timeoutMs: 1,
      });

      await vi.advanceTimersByTimeAsync(1);
      await expect(invoke).resolves.toEqual({
        ok: false,
        error: { code: "TIMEOUT", message: "node invoke timed out" },
      });
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
      expect(
        registry.authorizeSystemRunEvent({
          nodeId: "node-1",
          connId: "conn-1",
          runId: "run-timeout",
          sessionKey: "agent:main:main",
          terminal: true,
        }),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows the CoreBlow macOS legacy runId fallback only for one matching run", () => {
    const registry = new NodeRegistry();
    registry.register(makeClient("conn-1", "node-1"), {});
    const first = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      params: { runId: "run-a", sessionKey: "agent:main:main" },
      timeoutMs: 1_000,
    });

    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "runtime-run",
        sessionKey: "agent:main:main",
        terminal: false,
      }),
    ).toBe(true);
    const second = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      params: { runId: "run-b", sessionKey: "agent:main:main" },
      timeoutMs: 1_000,
    });
    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        sessionKey: "agent:main:main",
        terminal: true,
      }),
    ).toBe(false);
    registry.unregister("conn-1");
    void first.catch(() => {});
    void second.catch(() => {});
  });

  it("rejects legacy runId fallback for non-macOS node hosts", () => {
    const registry = new NodeRegistry();
    registry.register(makeClient("conn-1", "node-1", [], { clientId: "node-host", platform: "linux" }), {});
    const invoke = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      params: { runId: "gateway-run", sessionKey: "agent:main:main" },
      timeoutMs: 1_000,
    });

    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: "runtime-run",
        sessionKey: "agent:main:main",
        terminal: true,
      }),
    ).toBe(false);
    registry.unregister("conn-1");
    void invoke.catch(() => {});
  });

  it("generates a runId and clears authorization on failed invoke result", async () => {
    const registry = new NodeRegistry();
    const frames: string[] = [];
    registry.register(makeClient("conn-1", "node-1", frames), {});
    const invoke = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      params: { command: ["printf", "ok"], sessionKey: "agent:main:main" },
      timeoutMs: 1_000,
    });
    const request = JSON.parse(frames[0] ?? "{}") as {
      payload?: { id?: string; paramsJSON?: string | null };
    };
    const forwarded = JSON.parse(request.payload?.paramsJSON ?? "{}") as { runId?: string };
    expect(typeof forwarded.runId).toBe("string");

    expect(
      registry.handleInvokeResult({
        id: request.payload?.id ?? "",
        nodeId: "node-1",
        connId: "conn-1",
        ok: false,
        error: { code: "INVALID_REQUEST", message: "invalid params" },
      }),
    ).toBe(true);
    await expect(invoke).resolves.toMatchObject({ ok: false });
    expect(
      registry.authorizeSystemRunEvent({
        nodeId: "node-1",
        connId: "conn-1",
        runId: forwarded.runId,
        sessionKey: "agent:main:main",
        terminal: true,
      }),
    ).toBe(false);
  });

  it("sends only branded raw event payloads without changing envelope shape", () => {
    const registry = new NodeRegistry();
    const frames: string[] = [];
    registry.register(makeClient("conn-1", "node-1", frames), {});
    const payload = serializeEventPayload({ foo: "bar" });

    expect(registry.sendEventRaw("node-1", "chat", payload)).toBe(true);
    expect(registry.sendEventRaw("missing-node", "chat", payload)).toBe(false);
    expect(registry.sendEventRaw("node-1", "heartbeat", null)).toBe(true);
    expect(
      registry.sendEventRaw(
        "node-1",
        "chat",
        "not-json" as unknown as Parameters<NodeRegistry["sendEventRaw"]>[2],
      ),
    ).toBe(false);

    expect(frames).toEqual([
      '{"type":"event","event":"chat","payload":{"foo":"bar"}}',
      '{"type":"event","event":"heartbeat"}',
    ]);
  });

  it("refreshes the effective surface only within its declared surface", () => {
    const registry = new NodeRegistry();
    const client = makeClient("conn-1", "node-1", [], {
      declaredCaps: ["talk"],
      declaredCommands: ["talk.ptt.start"],
      declaredPermissions: { microphone: true, camera: false },
    });

    registry.register(client, {});
    const updated = registry.updateSurface("node-1", {
      caps: ["talk", "screen"],
      commands: ["talk.ptt.start", "system.run"],
      permissions: { microphone: true, camera: true },
    });

    expect(updated?.caps).toEqual(["talk"]);
    expect(updated?.commands).toEqual(["talk.ptt.start"]);
    expect(updated?.permissions).toEqual({ microphone: true, camera: false });
    expect(client.connect.caps).toEqual(["talk"]);
    expect((client.connect as { commands?: string[] }).commands).toEqual(["talk.ptt.start"]);

    const cleared = registry.updateSurface("node-1", {
      caps: [],
      commands: [],
      permissions: undefined,
    });
    expect(cleared?.permissions).toBeUndefined();
  });
});
