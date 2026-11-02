import { describe, expect, it } from "vitest";
import * as channelBarrel from "./channel.js";
import * as providerBarrel from "./provider.js";
import * as toolBarrel from "./tool.js";
import * as memoryBarrel from "./memory.js";
import * as approvalBarrel from "./approval.js";

// Legacy public subpath imports
import * as commandStatusRuntime from "./command-status-runtime.js";
import * as nativeCommandRegistry from "./native-command-registry.js";
import * as ssrfDispatcher from "./ssrf-dispatcher.js";
import * as browserRuntime from "./browser-runtime.js";
import * as telegramAccount from "./telegram-account.js";
import * as openaiProvider from "./openai.js";

describe("Developer SDK Contracts & External Plugin Compatibility", () => {
  describe("Pillar 1: Five Canonical Thematic Domain Barrels", () => {
    it("loads channel domain barrel (coreblow/plugin-sdk/channel)", () => {
      expect(typeof channelBarrel.formatInboundEnvelope).toBe("function");
      expect(typeof channelBarrel.createRunStateMachine).toBe("function");
      expect(typeof channelBarrel.createAccountStatusSink).toBe("function");
      expect(typeof channelBarrel.createChannelPairingController).toBe("function");
    });

    it("loads provider domain barrel (coreblow/plugin-sdk/provider)", () => {
      expect(providerBarrel.CORE_DOP_PROVIDER_CATALOG).toBeDefined();
      expect(typeof providerBarrel.resolveDopProviderDescriptor).toBe("function");
      expect(typeof providerBarrel.streamOpenAiCompatibleCompletion).toBe("function");
      expect(typeof providerBarrel.buildChatCompletionRequest).toBe("function");
    });

    it("loads tool domain barrel (coreblow/plugin-sdk/tool)", () => {
      expect(typeof toolBarrel.readStringParam).toBe("function");
      expect(typeof toolBarrel.readBooleanParam).toBe("function");
      expect(typeof toolBarrel.readNumberParam).toBe("function");
      expect(typeof toolBarrel.readStringArrayParam).toBe("function");
    });

    it("loads memory domain barrel (coreblow/plugin-sdk/memory)", () => {
      expect(typeof memoryBarrel.CoryBootstrapService).toBe("function");
      expect(typeof memoryBarrel.CoryRetriever).toBe("function");
      expect(typeof memoryBarrel.CoryContextAssembler).toBe("function");
      expect(typeof memoryBarrel.MemoryOrchestrator).toBe("function");
    });

    it("loads approval domain barrel (coreblow/plugin-sdk/approval)", () => {
      expect(typeof approvalBarrel.CapabilityConsentLedger).toBe("function");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("network");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("filesystem");
    });
  });

  describe("Pillar 2: Preserved Legacy Public Subpath Compatibility", () => {
    it("loads command-status-runtime facade", () => {
      expect(commandStatusRuntime).toBeDefined();
    });

    it("loads native-command-registry facade", () => {
      expect(nativeCommandRegistry).toBeDefined();
    });

    it("loads ssrf-dispatcher facade", () => {
      expect(ssrfDispatcher).toBeDefined();
    });

    it("loads browser-runtime facade", () => {
      expect(typeof browserRuntime.closeTrackedBrowserTabsForSessions).toBe("function");
    });

    it("loads telegram-account facade", () => {
      expect(typeof telegramAccount.resolveTelegramAccount).toBe("function");
    });

    it("loads openai provider facade", () => {
      expect(openaiProvider).toBeDefined();
    });
  });

  describe("Pillar 3: External Plugin Fixture (Published SDK Interfaces Only)", () => {
    interface ExternalCommunityPluginDefinition {
      readonly id: string;
      readonly name: string;
      readonly version: string;
      readonly capabilities: readonly string[];
      init(context: {
        envelope: typeof channelBarrel.formatInboundEnvelope;
        readParam: typeof toolBarrel.readStringParam;
      }): { status: "initialized" };
    }

    it("compiles and executes a clean third-party external plugin using only public SDK interfaces", () => {
      const fixturePlugin: ExternalCommunityPluginDefinition = {
        id: "fixture-community-channel",
        name: "Fixture Community Channel",
        version: "1.0.0",
        capabilities: ["network", "webhook"],
        init(context) {
          const envelope = context.envelope({
            channel: "chan-abc",
            from: "user-123",
            body: "hello world",
          });
          expect(envelope).toBeDefined();

          const paramValue = context.readParam({ apiKey: "secret-key" }, "apiKey");
          expect(paramValue).toBe("secret-key");

          return { status: "initialized" };
        },
      };

      const result = fixturePlugin.init({
        envelope: channelBarrel.formatInboundEnvelope,
        readParam: toolBarrel.readStringParam,
      });

      expect(result.status).toBe("initialized");
    });
  });
});
