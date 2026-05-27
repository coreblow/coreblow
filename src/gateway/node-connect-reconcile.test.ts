import { describe, expect, it, vi } from "vitest";
import type { NodePairingPairedNode, NodePairingPendingRequest } from "../infra/node-pairing.js";
import { reconcileNodePairingOnConnect } from "./node-connect-reconcile.js";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "./protocol/client-info.js";
import type { ConnectParams } from "./protocol/index.js";

type NodePairingRequestInput = Omit<
  NodePairingPendingRequest,
  "requestId" | "ts" | "isRepair"
>;

function makeNodeConnectParams(overrides?: Partial<ConnectParams>): ConnectParams {
  const params = {
    minProtocol: 1,
    maxProtocol: 1,
    client: {
      id: GATEWAY_CLIENT_IDS.IOS_APP,
      version: "test",
      platform: "ios",
      mode: GATEWAY_CLIENT_MODES.NODE,
    },
    commands: ["canvas.snapshot"],
    ...overrides,
  };
  return params as unknown as ConnectParams;
}

function makePairedNode(overrides?: Partial<NodePairingPairedNode>): NodePairingPairedNode {
  return {
    nodeId: "coreblow-ios",
    token: "token-1",
    createdAtMs: 1,
    approvedAtMs: 1,
    ...overrides,
  };
}

function makeRequestPairing() {
  return vi.fn(async (input: NodePairingRequestInput) => ({
    status: "pending" as const,
    request: { ...input, requestId: "req-1", ts: 1 },
    created: true,
  }));
}

describe("reconcileNodePairingOnConnect", () => {
  it("keeps first-time declared node surfaces pending rather than live", async () => {
    const requestPairing = makeRequestPairing();

    const result = await reconcileNodePairingOnConnect({
      cfg: {} as never,
      connectParams: makeNodeConnectParams({
        caps: [" talk ", "talk"],
        permissions: { camera: true, notifications: false },
      }),
      pairedNode: null,
      requestPairing,
    });

    expect(result.declaredCaps).toEqual(["talk"]);
    expect(result.effectiveCaps).toEqual([]);
    expect(result.declaredCommands).toEqual(["canvas.snapshot"]);
    expect(result.effectiveCommands).toEqual([]);
    expect(result.declaredPermissions).toEqual({ camera: true, notifications: false });
    expect(result.effectivePermissions).toBeUndefined();
    expect(requestPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "coreblow-ios",
        caps: ["talk"],
        commands: ["canvas.snapshot"],
        permissions: { camera: true, notifications: false },
      }),
    );
  });

  it("requests approval for added capabilities and permissions while retaining approved live surface", async () => {
    const requestPairing = makeRequestPairing();

    const result = await reconcileNodePairingOnConnect({
      cfg: {} as never,
      connectParams: makeNodeConnectParams({
        caps: ["camera", "screen"],
        commands: [],
        permissions: { camera: true, notifications: true },
      }),
      pairedNode: makePairedNode({
        caps: ["camera"],
        commands: [],
        permissions: { camera: true },
      }),
      requestPairing,
    });

    expect(result.effectiveCaps).toEqual(["camera"]);
    expect(result.effectivePermissions).toEqual({ camera: true });
    expect(requestPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        caps: ["camera", "screen"],
        permissions: { camera: true, notifications: true },
      }),
    );
  });

  it("keeps an added command pending until the paired record approves it", async () => {
    const requestPairing = makeRequestPairing();

    const result = await reconcileNodePairingOnConnect({
      cfg: {} as never,
      connectParams: makeNodeConnectParams({
        commands: ["canvas.snapshot", "camera.list"],
      }),
      pairedNode: makePairedNode({
        commands: ["canvas.snapshot"],
      }),
      requestPairing,
    });

    expect(result.declaredCommands).toEqual(["canvas.snapshot", "camera.list"]);
    expect(result.effectiveCommands).toEqual(["canvas.snapshot"]);
    expect(requestPairing).toHaveBeenCalled();
  });

  it("uses the declared surfaces directly when they still match approval", async () => {
    const requestPairing = makeRequestPairing();

    const result = await reconcileNodePairingOnConnect({
      cfg: {} as never,
      connectParams: makeNodeConnectParams({
        caps: ["camera"],
        permissions: { camera: true },
      }),
      pairedNode: makePairedNode({
        caps: ["camera"],
        commands: ["canvas.snapshot"],
        permissions: { camera: true },
      }),
      requestPairing,
    });

    expect(result.effectiveCaps).toEqual(["camera"]);
    expect(result.effectiveCommands).toEqual(["canvas.snapshot"]);
    expect(result.effectivePermissions).toEqual({ camera: true });
    expect(requestPairing).not.toHaveBeenCalled();
  });
});
