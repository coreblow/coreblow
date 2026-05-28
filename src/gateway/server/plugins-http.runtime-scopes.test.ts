import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubsystemLogger } from "../../logging/subsystem.js";
import { createEmptyPluginRegistry } from "../../plugins/registry.js";
import { releasePinnedPluginHttpRouteRegistry, setActivePluginRegistry } from "../../plugins/runtime.js";
import { getPluginRuntimeGatewayRequestScope } from "../../plugins/runtime/gateway-request-scope.js";
import { CLI_DEFAULT_OPERATOR_SCOPES } from "../method-scopes.js";
import type { GatewayRequestContext } from "../server-methods/types.js";
import { makeMockHttpResponse } from "../test-http-response.js";
import { createTestRegistry } from "./__tests__/test-utils.js";
import { createGatewayPluginRequestHandler } from "./plugins-http.js";

function createRoute(params: {
  path: string;
  auth: "gateway" | "plugin";
  match?: "exact" | "prefix";
  gatewayRuntimeScopeSurface?: "write-default" | "trusted-operator";
  gatewayMethodDispatchAllowed?: boolean;
  handler?: (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>;
}) {
  return {
    pluginId: "route",
    path: params.path,
    auth: params.auth,
    gatewayRuntimeScopeSurface: params.gatewayRuntimeScopeSurface,
    gatewayMethodDispatchAllowed: params.gatewayMethodDispatchAllowed,
    match: params.match ?? "exact",
    handler: params.handler ?? (() => true),
    source: "route",
  };
}

function createMockLogger(): SubsystemLogger {
  const child = vi.fn<(name: string) => SubsystemLogger>();
  const logger = {
    subsystem: "test/plugins-http-runtime-scopes",
    isEnabled: () => true,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    raw: vi.fn(),
    child,
  } satisfies SubsystemLogger;
  child.mockImplementation(() => logger);
  return logger as SubsystemLogger;
}

describe("plugin HTTP route runtime scopes", () => {
  afterEach(() => {
    releasePinnedPluginHttpRouteRegistry();
    setActivePluginRegistry(createEmptyPluginRegistry());
  });

  it.each([
    {
      auth: "plugin" as const,
      gatewayAuthSatisfied: false,
      path: "/hook",
      gatewayRequestOperatorScopes: undefined,
      expectedScopes: [],
    },
    {
      auth: "gateway" as const,
      gatewayAuthSatisfied: true,
      path: "/secure-hook",
      gatewayRequestOperatorScopes: ["operator.read"],
      expectedScopes: ["operator.read"],
    },
  ])(
    "maps $auth routes to $expectedScopes",
    async ({ auth, gatewayAuthSatisfied, gatewayRequestOperatorScopes, path, expectedScopes }) => {
      let observedScopes: string[] | undefined;
      const handler = createGatewayPluginRequestHandler({
        registry: createTestRegistry({
          httpRoutes: [
            createRoute({
              path,
              auth,
              handler: vi.fn(async () => {
                observedScopes =
                  getPluginRuntimeGatewayRequestScope()?.client?.connect?.scopes?.slice() ?? [];
                return true;
              }),
            }),
          ],
        }),
        log: createMockLogger(),
      });

      const { res } = makeMockHttpResponse();
      const handled = await handler({ url: path } as IncomingMessage, res, undefined, {
        gatewayAuthSatisfied,
        gatewayRequestOperatorScopes,
      });

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(observedScopes).toEqual(expectedScopes);
    },
  );

  it("fails closed when gateway-auth route runtime scopes are missing", async () => {
    const log = createMockLogger();
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpRoutes: [createRoute({ path: "/secure-hook", auth: "gateway" })],
      }),
      log,
    });

    const { res } = makeMockHttpResponse();
    const handled = await handler({ url: "/secure-hook" } as IncomingMessage, res, undefined, {
      gatewayAuthSatisfied: true,
    });

    expect(handled).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(log.warn).toHaveBeenCalledWith(
      "plugin http route blocked without caller scope context (/secure-hook)",
    );
  });

  it("restores trusted-operator defaults for routes opting into trusted surface", async () => {
    let observedScopes: string[] | undefined;
    const log = createMockLogger();
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpRoutes: [
          createRoute({
            path: "/secure-admin-hook",
            auth: "gateway",
            gatewayRuntimeScopeSurface: "trusted-operator",
            handler: async () => {
              observedScopes =
                getPluginRuntimeGatewayRequestScope()?.client?.connect?.scopes?.slice() ?? [];
              return true;
            },
          }),
        ],
      }),
      log,
    });

    const response = makeMockHttpResponse();
    const handled = await handler(
      { url: "/secure-admin-hook" } as IncomingMessage,
      response.res,
      undefined,
      {
        gatewayAuthSatisfied: true,
        gatewayRequestAuth: { authMethod: "token", trustDeclaredOperatorScopes: false },
        gatewayRequestOperatorScopes: ["operator.write"],
      },
    );

    expect(handled).toBe(true);
    expect(response.res.statusCode).toBe(200);
    expect(log.warn).not.toHaveBeenCalled();
    expect(observedScopes).toEqual(CLI_DEFAULT_OPERATOR_SCOPES);
  });

  it("threads plugin route identity and gateway dispatch entitlement into runtime scope", async () => {
    let observed:
      | {
          pluginId: string | undefined;
          pluginSource: string | undefined;
          gatewayMethodDispatchAllowed: boolean | undefined;
          context: GatewayRequestContext | undefined;
        }
      | undefined;
    const gatewayContext = { label: "gateway" } as unknown as GatewayRequestContext;
    const handler = createGatewayPluginRequestHandler({
      registry: createTestRegistry({
        httpRoutes: [
          createRoute({
            path: "/secure-hook",
            auth: "gateway",
            gatewayMethodDispatchAllowed: true,
            handler: async () => {
              const scope = getPluginRuntimeGatewayRequestScope();
              observed = {
                pluginId: scope?.pluginId,
                pluginSource: scope?.pluginSource,
                gatewayMethodDispatchAllowed: scope?.gatewayMethodDispatchAllowed,
                context: scope?.context,
              };
              return true;
            },
          }),
        ],
      }),
      log: createMockLogger(),
      getGatewayRequestContext: () => gatewayContext,
    });

    const { res } = makeMockHttpResponse();
    const handled = await handler({ url: "/secure-hook" } as IncomingMessage, res, undefined, {
      gatewayAuthSatisfied: true,
      gatewayRequestOperatorScopes: ["operator.write"],
    });

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(observed).toEqual({
      pluginId: "route",
      pluginSource: "route",
      gatewayMethodDispatchAllowed: true,
      context: gatewayContext,
    });
  });
});
