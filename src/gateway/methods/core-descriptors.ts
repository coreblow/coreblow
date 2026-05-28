import type { OperatorScope } from "../method-scopes.js";
import {
  isGatewayMethodClassified,
  isNodeRoleMethod,
  resolveRequiredOperatorScopeForMethod,
} from "../method-scopes.js";
import {
  NODE_GATEWAY_METHOD_SCOPE,
  type GatewayMethodDescriptorInput,
  type GatewayMethodHandler,
  type GatewayMethodScope,
} from "./descriptor.js";

const CONTROL_PLANE_WRITE_METHODS = new Set(["config.apply", "config.patch", "update.run"]);

export const STARTUP_UNAVAILABLE_GATEWAY_METHODS = [
  "models.list",
  "tools.effective",
  "sessions.list",
  "sessions.create",
  "sessions.send",
  "sessions.abort",
  "agent.wait",
  "chat.history",
] as const;

const STARTUP_UNAVAILABLE_GATEWAY_METHOD_SET = new Set<string>(
  STARTUP_UNAVAILABLE_GATEWAY_METHODS,
);

export function isCoreGatewayMethodClassified(method: string): boolean {
  return isGatewayMethodClassified(method);
}

export function resolveCoreGatewayMethodScope(method: string): GatewayMethodScope | undefined {
  if (isNodeRoleMethod(method)) {
    return NODE_GATEWAY_METHOD_SCOPE;
  }
  return resolveRequiredOperatorScopeForMethod(method);
}

export function createCoreGatewayMethodDescriptors(
  handlers: Record<string, GatewayMethodHandler>,
  params?: {
    defaultScope?: OperatorScope;
    area?: string;
  },
): GatewayMethodDescriptorInput[] {
  return Object.entries(handlers).map(([name, handler]) => {
    const scope = resolveCoreGatewayMethodScope(name) ?? params?.defaultScope;
    if (!scope) {
      throw new Error(`gateway method is missing a scope: ${name}`);
    }
    return {
      name,
      handler,
      owner: { kind: "core", area: params?.area ?? "gateway" },
      scope,
      ...(STARTUP_UNAVAILABLE_GATEWAY_METHOD_SET.has(name)
        ? { startup: "unavailable-until-sidecars" as const }
        : {}),
      ...(CONTROL_PLANE_WRITE_METHODS.has(name) ? { controlPlaneWrite: true } : {}),
    };
  });
}
