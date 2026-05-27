import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/config.js";
import type { PluginApprovalRequestPayload } from "../infra/plugin-approvals.js";
import {
  DEFAULT_PLUGIN_APPROVAL_TIMEOUT_MS,
  MAX_PLUGIN_APPROVAL_TIMEOUT_MS,
} from "../infra/plugin-approvals.js";
import type { PluginRegistry } from "../plugins/registry.js";
import { getActivePluginRegistry } from "../plugins/runtime.js";
import type {
  CoreBlowPluginNodeInvokePolicyContext,
  CoreBlowPluginNodeInvokePolicyResult,
  CoreBlowPluginNodeInvokeTransportResult,
} from "../plugins/types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { NodeSession } from "./node-registry.js";
import type { GatewayClient, GatewayRequestContext } from "./server-methods/types.js";

type PluginNodeInvokePolicyDependencies = {
  getRegistry: () => PluginRegistry | null;
  getConfig: () => CoreBlowConfig;
  createApprovalId: () => string;
};

function parseScopes(client: GatewayClient | null): string[] {
  return Array.isArray(client?.connect.scopes)
    ? client.connect.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
}

function parsePayload(payloadJSON: string | null | undefined, payload: unknown): unknown {
  if (!payloadJSON) {
    return payload;
  }
  try {
    return JSON.parse(payloadJSON) as unknown;
  } catch {
    return payload;
  }
}

function findDangerousPluginNodeCommand(registry: PluginRegistry | null, command: string) {
  const normalizedCommand = command.trim();
  return (
    registry?.nodeHostCommands?.find(
      (entry) =>
        entry.command.dangerous === true && entry.command.command.trim() === normalizedCommand,
    ) ?? null
  );
}

export class PluginNodeInvokePolicyService {
  constructor(
    private readonly deps: PluginNodeInvokePolicyDependencies = {
      getRegistry: getActivePluginRegistry,
      getConfig: loadConfig,
      createApprovalId: () => `plugin:${randomUUID()}`,
    },
  ) {}

  private createApprovalRuntime(params: {
    context: GatewayRequestContext;
    client: GatewayClient | null;
    pluginId: string;
  }): CoreBlowPluginNodeInvokePolicyContext["approvals"] | undefined {
    const manager = params.context.pluginApprovalManager;
    if (!manager) {
      return undefined;
    }
    return {
      request: async (input) => {
        const requestedTimeout =
          typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
            ? input.timeoutMs
            : DEFAULT_PLUGIN_APPROVAL_TIMEOUT_MS;
        const timeoutMs = Math.min(requestedTimeout, MAX_PLUGIN_APPROVAL_TIMEOUT_MS);
        const request: PluginApprovalRequestPayload = {
          pluginId: params.pluginId,
          title: input.title.slice(0, 80),
          description: input.description.slice(0, 256),
          severity: input.severity ?? "warning",
          toolName: input.toolName?.trim() || null,
          toolCallId: input.toolCallId?.trim() || null,
          agentId: input.agentId?.trim() || null,
          sessionKey: input.sessionKey?.trim() || null,
        };
        const record = manager.create(request, timeoutMs, this.deps.createApprovalId());
        record.requestedByConnId = params.client?.connId ?? null;
        record.requestedByDeviceId = params.client?.connect.device?.id ?? null;
        record.requestedByClientId = params.client?.connect.client?.id ?? null;
        const decisionPromise = manager.register(record, timeoutMs);
        params.context.broadcast(
          "plugin.approval.requested",
          {
            id: record.id,
            request: record.request,
            createdAtMs: record.createdAtMs,
            expiresAtMs: record.expiresAtMs,
          },
          { dropIfSlow: true },
        );
        const hasApprovalClients =
          params.context.hasExecApprovalClients?.(params.client?.connId) ?? false;
        if (!hasApprovalClients) {
          manager.expire(record.id, "no-approval-route");
          return { id: record.id, decision: null };
        }
        return { id: record.id, decision: await decisionPromise };
      },
    };
  }

  async apply(params: {
    context: GatewayRequestContext;
    client: GatewayClient | null;
    nodeSession: NodeSession;
    command: string;
    params: unknown;
    timeoutMs?: number;
    idempotencyKey?: string;
  }): Promise<CoreBlowPluginNodeInvokePolicyResult | null> {
    const registry = this.deps.getRegistry();
    const entry = registry?.nodeInvokePolicies?.find((candidate) =>
      candidate.policy.commands.includes(params.command),
    );
    if (!entry) {
      const dangerousCommand = findDangerousPluginNodeCommand(registry, params.command);
      if (dangerousCommand) {
        return {
          ok: false,
          code: "PLUGIN_POLICY_MISSING",
          message: `node.invoke ${params.command} is registered as dangerous by plugin ${dangerousCommand.pluginId} but has no plugin node.invoke policy`,
        };
      }
      return null;
    }

    const invokeNode: CoreBlowPluginNodeInvokePolicyContext["invokeNode"] = async (
      override = {},
    ): Promise<CoreBlowPluginNodeInvokeTransportResult> => {
      const result = await params.context.nodeRegistry.invoke({
        nodeId: params.nodeSession.nodeId,
        command: params.command,
        params: override.params ?? params.params,
        timeoutMs: override.timeoutMs ?? params.timeoutMs,
        idempotencyKey: override.idempotencyKey ?? params.idempotencyKey,
      });
      if (!result.ok) {
        return {
          ok: false,
          code: result.error?.code,
          message: result.error?.message ?? "node command failed",
          details: { nodeError: result.error ?? null },
        };
      }
      return {
        ok: true,
        payload: parsePayload(result.payloadJSON, result.payload),
        payloadJSON: result.payloadJSON ?? null,
      };
    };

    return await entry.policy.handle({
      nodeId: params.nodeSession.nodeId,
      command: params.command,
      params: params.params,
      timeoutMs: params.timeoutMs,
      idempotencyKey: params.idempotencyKey,
      config: this.deps.getConfig(),
      pluginConfig: entry.pluginConfig,
      node: {
        nodeId: params.nodeSession.nodeId,
        displayName: params.nodeSession.displayName,
        platform: params.nodeSession.platform,
        deviceFamily: params.nodeSession.deviceFamily,
        commands: params.nodeSession.commands,
      },
      client: params.client
        ? {
            connId: params.client.connId,
            scopes: parseScopes(params.client),
          }
        : null,
      approvals: this.createApprovalRuntime({
        context: params.context,
        client: params.client,
        pluginId: entry.pluginId,
      }),
      invokeNode,
    });
  }
}

const pluginNodeInvokePolicyService = new PluginNodeInvokePolicyService();

export function applyPluginNodeInvokePolicy(
  params: Parameters<PluginNodeInvokePolicyService["apply"]>[0],
): Promise<CoreBlowPluginNodeInvokePolicyResult | null> {
  return pluginNodeInvokePolicyService.apply(params);
}
