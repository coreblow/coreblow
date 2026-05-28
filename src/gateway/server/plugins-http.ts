import type { IncomingMessage, ServerResponse } from "node:http";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import { resolveActivePluginHttpRouteRegistry } from "../../plugins/runtime.js";
import { withPluginRuntimeGatewayRequestScope } from "../../plugins/runtime/gateway-request-scope.js";
import type { AuthorizedGatewayHttpRequest } from "../http-auth-utils.js";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "../protocol/client-info.js";
import type { ConnectParams } from "../protocol/index.js";
import { PROTOCOL_VERSION } from "../protocol/index.js";
import type { GatewayRequestContext, GatewayRequestOptions } from "../server-methods/types.js";
import { resolvePluginRouteRuntimeOperatorScopes } from "./plugin-route-runtime-scopes.js";
import {
  resolvePluginRoutePathContext,
  type PluginRoutePathContext,
} from "./plugins-http/path-context.js";
import { matchedPluginRoutesRequireGatewayAuth } from "./plugins-http/route-auth.js";
import { findMatchingPluginHttpRoutes } from "./plugins-http/route-match.js";

export {
  isProtectedPluginRoutePathFromContext,
  resolvePluginRoutePathContext,
  type PluginRoutePathContext,
} from "./plugins-http/path-context.js";
export {
  findRegisteredPluginHttpRoute,
  isRegisteredPluginHttpRoutePath,
} from "./plugins-http/route-match.js";
export { shouldEnforceGatewayAuthForPluginPath } from "./plugins-http/route-auth.js";
export {
  findMatchingPluginNodeCapabilityRoute,
  findMatchingPluginNodeCapabilityRoutes,
  listPluginNodeCapabilities,
  listPluginNodeCapabilitySurfaces,
} from "./plugins-http/route-capability.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;
type PluginHttpRouteEntry = NonNullable<PluginRegistry["httpRoutes"]>[number] & {
  gatewayRuntimeScopeSurface?: "write-default" | "trusted-operator";
  gatewayMethodDispatchAllowed?: boolean;
};

function createPluginRouteRuntimeClient(
  scopes: readonly string[],
): GatewayRequestOptions["client"] {
  return {
    connect: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: GATEWAY_CLIENT_IDS.GATEWAY_CLIENT,
        version: "internal",
        platform: "node",
        mode: GATEWAY_CLIENT_MODES.BACKEND,
      },
      role: "operator",
      scopes: [...scopes],
    } as ConnectParams,
  };
}

export type PluginRouteDispatchContext = {
  gatewayAuthSatisfied?: boolean;
  gatewayRequestAuth?: AuthorizedGatewayHttpRequest;
  gatewayRequestOperatorScopes?: readonly string[];
};

export type PluginHttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  pathContext?: PluginRoutePathContext,
  dispatchContext?: PluginRouteDispatchContext,
) => Promise<boolean>;

export function createGatewayPluginRequestHandler(params: {
  registry: PluginRegistry;
  getRouteRegistry?: () => PluginRegistry;
  log: SubsystemLogger;
  getGatewayRequestContext?: () => GatewayRequestContext | undefined;
}): PluginHttpRequestHandler {
  const { log } = params;
  return async (req, res, providedPathContext, dispatchContext) => {
    const registry =
      params.getRouteRegistry?.() ?? resolveActivePluginHttpRouteRegistry(params.registry);
    const gatewayRequestContext = params.getGatewayRequestContext?.();
    const routes = registry.httpRoutes ?? [];
    if (routes.length === 0) {
      return false;
    }

    const pathContext =
      providedPathContext ??
      (() => {
        const url = new URL(req.url ?? "/", "http://localhost");
        return resolvePluginRoutePathContext(url.pathname);
      })();
    const matchedRoutes = findMatchingPluginHttpRoutes(registry, pathContext);
    if (matchedRoutes.length === 0) {
      return false;
    }
    const requiresGatewayAuth = matchedPluginRoutesRequireGatewayAuth(matchedRoutes);
    if (requiresGatewayAuth && dispatchContext?.gatewayAuthSatisfied === false) {
      log.warn(`plugin http route blocked without gateway auth (${pathContext.canonicalPath})`);
      return false;
    }
    const gatewayRequestAuth = dispatchContext?.gatewayRequestAuth;
    const gatewayRequestOperatorScopes = dispatchContext?.gatewayRequestOperatorScopes;

    for (const route of matchedRoutes as PluginHttpRouteEntry[]) {
      if (route.auth !== "gateway") {
        continue;
      }
      if (route.gatewayRuntimeScopeSurface === "trusted-operator") {
        if (!gatewayRequestAuth) {
          log.warn(
            `plugin http route blocked without caller auth context (${pathContext.canonicalPath})`,
          );
          return false;
        }
        continue;
      }
      if (gatewayRequestOperatorScopes === undefined) {
        log.warn(
          `plugin http route blocked without caller scope context (${pathContext.canonicalPath})`,
        );
        return false;
      }
    }

    for (const route of matchedRoutes as PluginHttpRouteEntry[]) {
      let runtimeScopes: readonly string[] = [];
      if (route.auth === "gateway") {
        runtimeScopes =
          route.gatewayRuntimeScopeSurface === "trusted-operator"
            ? resolvePluginRouteRuntimeOperatorScopes(
                req,
                gatewayRequestAuth!,
                "trusted-operator",
              )
            : gatewayRequestOperatorScopes!;
      }

      const runtimeClient = createPluginRouteRuntimeClient(runtimeScopes);
      try {
        const handled = await withPluginRuntimeGatewayRequestScope(
          {
            ...(gatewayRequestContext ? { context: gatewayRequestContext } : {}),
            client: runtimeClient,
            isWebchatConnect: () => false,
            ...(route.pluginId ? { pluginId: route.pluginId } : {}),
            ...(route.source ? { pluginSource: route.source } : {}),
            ...(route.gatewayMethodDispatchAllowed === true
              ? { gatewayMethodDispatchAllowed: true }
              : {}),
          },
          async () => route.handler(req, res),
        );
        if (handled !== false) {
          return true;
        }
      } catch (err) {
        log.warn(`plugin http route failed (${route.pluginId ?? "unknown"}): ${String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Internal Server Error");
        }
        return true;
      }
    }
    return false;
  };
}
