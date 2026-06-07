import { describe, expect, it } from "vitest";
import type { CliDeps } from "../cli/deps.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  getPluginRuntimeGatewayRequestScope,
  withPluginRuntimeGatewayRequestScope,
} from "../plugins/runtime/gateway-request-scope.js";
import {
  createLocalGatewayRequestContext,
  withLocalGatewayRequestScope,
} from "./local-request-context.js";
import type { GatewayRequestContext } from "./server-methods/types.js";

const params = {
  deps: {} as CliDeps,
  getRuntimeConfig: () => ({ agents: { defaults: {} } }) as CoreBlowConfig,
};

describe("local gateway request context", () => {
  it("creates a local scope with functional in-process bookkeeping", async () => {
    await withLocalGatewayRequestScope(params, async () => {
      const context = getPluginRuntimeGatewayRequestScope()?.context;
      expect(context).toBeDefined();
      context?.addChatRun("run-1", { sessionKey: "agent:main:main", clientRunId: "client-1" });
      expect(context?.removeChatRun("run-1", "client-1", "agent:main:main")).toEqual({
        sessionKey: "agent:main:main",
        clientRunId: "client-1",
      });

      context?.subscribeSessionEvents("conn-1");
      expect(context?.getSessionEventSubscriberConnIds().has("conn-1")).toBe(true);
      context?.unsubscribeAllSessionEvents("conn-1");
      expect(context?.getSessionEventSubscriberConnIds().has("conn-1")).toBe(false);
    });
  });

  it("keeps an existing gateway request context when already scoped", async () => {
    const existingContext = createLocalGatewayRequestContext(params);

    await withPluginRuntimeGatewayRequestScope(
      { context: existingContext, isWebchatConnect: () => true },
      async () => {
        await withLocalGatewayRequestScope(params, async () => {
          expect(getPluginRuntimeGatewayRequestScope()?.context).toBe(existingContext);
        });
      },
    );
  });

  it("rejects unavailable channel and cron operations in embedded local context", async () => {
    const context: GatewayRequestContext = createLocalGatewayRequestContext(params);

    await expect(context.startChannel("telegram")).rejects.toThrow("Channel start is unavailable");
    await expect(context.cron.status()).rejects.toThrow("Cron is unavailable");
  });
});
