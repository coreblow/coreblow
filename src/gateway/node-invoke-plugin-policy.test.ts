import { describe, expect, it, vi } from "vitest";
import type { PluginApprovalRequestPayload } from "../infra/plugin-approvals.js";
import { createEmptyPluginRegistry, type PluginRegistry } from "../plugins/registry.js";
import type { CoreBlowPluginNodeInvokePolicyContext } from "../plugins/types.js";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import { PluginNodeInvokePolicyService } from "./node-invoke-plugin-policy.js";
import type { NodeSession } from "./node-registry.js";
import type { GatewayClient, GatewayRequestContext } from "./server-methods/types.js";

function createNodeSession(): NodeSession {
  return {
    nodeId: "node-1",
    connId: "conn-node",
    client: {} as NodeSession["client"],
    commands: ["demo.read"],
    caps: [],
    connectedAtMs: 0,
  };
}

function createContext(opts?: {
  pluginApprovalManager?: ExecApprovalManager<PluginApprovalRequestPayload>;
  hasExecApprovalClients?: boolean;
}) {
  const invoke = vi.fn(async () => ({
    ok: true,
    payload: { ok: true, value: 1 },
    payloadJSON: null,
    error: null,
  }));
  return {
    invoke,
    context: {
      nodeRegistry: { invoke },
      pluginApprovalManager: opts?.pluginApprovalManager,
      broadcast: vi.fn(),
      hasExecApprovalClients: () => opts?.hasExecApprovalClients === true,
    } as unknown as GatewayRequestContext,
  };
}

function createRegistry(): PluginRegistry {
  return createEmptyPluginRegistry();
}

function createService(registry: PluginRegistry) {
  return new PluginNodeInvokePolicyService({
    getRegistry: () => registry,
    getConfig: () => ({ gateway: {} }),
    createApprovalId: () => "plugin:approval-1",
  });
}

describe("PluginNodeInvokePolicyService", () => {
  it("fails closed for dangerous plugin node commands without a policy", async () => {
    const registry = createRegistry();
    registry.nodeHostCommands?.push({
      pluginId: "demo",
      command: {
        command: "demo.read",
        dangerous: true,
        handle: async () => "{}",
      },
      source: "test",
    });
    const { context, invoke } = createContext();

    const result = await createService(registry).apply({
      context,
      client: null,
      nodeSession: createNodeSession(),
      command: "demo.read",
      params: { path: "/tmp/x" },
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: "PLUGIN_POLICY_MISSING" }),
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("lets a matching plugin policy mediate the node transport", async () => {
    const registry = createRegistry();
    registry.nodeInvokePolicies?.push({
      pluginId: "demo",
      policy: {
        commands: ["demo.read"],
        handle: (ctx: CoreBlowPluginNodeInvokePolicyContext) =>
          ctx.invokeNode({ params: { approved: true } }),
      },
      pluginConfig: { enabled: true },
      source: "test",
    });
    const { context, invoke } = createContext();

    const result = await createService(registry).apply({
      context,
      client: null,
      nodeSession: createNodeSession(),
      command: "demo.read",
      params: { approved: false },
      timeoutMs: 500,
      idempotencyKey: "invoke-1",
    });

    expect(result).toEqual({ ok: true, payload: { ok: true, value: 1 }, payloadJSON: null });
    expect(invoke).toHaveBeenCalledWith({
      nodeId: "node-1",
      command: "demo.read",
      params: { approved: true },
      timeoutMs: 500,
      idempotencyKey: "invoke-1",
    });
  });

  it("binds plugin approval requests to the invoking client", async () => {
    const manager = new ExecApprovalManager<PluginApprovalRequestPayload>();
    const registry = createRegistry();
    registry.nodeInvokePolicies?.push({
      pluginId: "demo",
      policy: {
        commands: ["demo.read"],
        handle: async (ctx) => ({
          ok: true,
          payload: await ctx.approvals?.request({
            title: "Sensitive action",
            description: "Needs approval",
          }),
        }),
      },
      source: "test",
    });
    const { context } = createContext({
      pluginApprovalManager: manager,
      hasExecApprovalClients: true,
    });
    const client = {
      connId: "conn-requester",
      connect: {
        client: { id: "client-owner" },
        device: { id: "device-owner" },
        scopes: ["operator.approvals"],
      },
    } as GatewayClient;

    const resultPromise = createService(registry).apply({
      context,
      client,
      nodeSession: createNodeSession(),
      command: "demo.read",
      params: {},
    });

    await vi.waitFor(() => expect(manager.getSnapshot("plugin:approval-1")).not.toBeNull());
    const record = manager.getSnapshot("plugin:approval-1");
    expect(record?.requestedByConnId).toBe("conn-requester");
    expect(record?.requestedByDeviceId).toBe("device-owner");
    expect(record?.requestedByClientId).toBe("client-owner");
    expect(context.broadcast).toHaveBeenCalledWith(
      "plugin.approval.requested",
      expect.objectContaining({ id: "plugin:approval-1" }),
      { dropIfSlow: true },
    );

    expect(manager.resolve("plugin:approval-1", "allow-once")).toBe(true);
    await expect(resultPromise).resolves.toEqual({
      ok: true,
      payload: { id: "plugin:approval-1", decision: "allow-once" },
    });
  });

  it("leaves commands without plugin risk metadata to normal invoke handling", async () => {
    const { context } = createContext();

    await expect(
      createService(createRegistry()).apply({
        context,
        client: null,
        nodeSession: createNodeSession(),
        command: "safe.echo",
        params: {},
      }),
    ).resolves.toBeNull();
  });
});
