import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as approvalBarrel from "./approval.js";
import * as channelBarrel from "./channel.js";
import * as memoryBarrel from "./memory.js";
import * as providerBarrel from "./provider.js";
import * as toolBarrel from "./tool.js";

describe("Plugin-SDK Thematic Domain Barrels", () => {
  describe("channel domain barrel (src/plugin-sdk/channel.ts)", () => {
    it("exports core channel lifecycle, envelope, pairing, and routing facades", () => {
      expect(typeof channelBarrel.formatInboundEnvelope).toBe("function");
      expect(typeof channelBarrel.createRunStateMachine).toBe("function");
      expect(typeof channelBarrel.createAccountStatusSink).toBe("function");
      expect(typeof channelBarrel.createChannelPairingController).toBe("function");
      expect(typeof channelBarrel.normalizeChannelRouteTarget).toBe("function");
      expect(typeof channelBarrel.normalizeChannelRouteRef).toBe("function");
    });
  });

  describe("provider domain barrel (src/plugin-sdk/provider.ts)", () => {
    it("exports provider catalog, auth, stream family facades, and DOP engine", () => {
      expect(providerBarrel.CORE_DOP_PROVIDER_CATALOG).toBeDefined();
      expect(typeof providerBarrel.resolveDopProviderDescriptor).toBe("function");
      expect(typeof providerBarrel.listBuiltInDopProviders).toBe("function");
      expect(typeof providerBarrel.isBuiltInDopProvider).toBe("function");
      expect(typeof providerBarrel.buildChatCompletionRequest).toBe("function");
      expect(typeof providerBarrel.parseSseLines).toBe("function");
      expect(typeof providerBarrel.extractStreamDelta).toBe("function");
      expect(typeof providerBarrel.streamOpenAiCompatibleCompletion).toBe("function");
      expect(typeof providerBarrel.buildDeepSeekProvider).toBe("function");
      expect(typeof providerBarrel.formatApiKeyPreview).toBe("function");
    });
  });

  describe("tool domain barrel (src/plugin-sdk/tool.ts)", () => {
    it("exports tool contracts, param parsers, and schema gates", () => {
      expect(typeof toolBarrel.readBooleanParam).toBe("function");
      expect(typeof toolBarrel.readStringParam).toBe("function");
      expect(typeof toolBarrel.readNumberParam).toBe("function");
      expect(typeof toolBarrel.readStringArrayParam).toBe("function");
      expect(toolBarrel.toolPluginMetadataSymbol).toBeDefined();
    });
  });

  describe("memory domain barrel (src/plugin-sdk/memory.ts)", () => {
    it("exports Cory built-in memory contracts, orchestrator, and root memory file helpers", () => {
      expect(typeof memoryBarrel.CoryBootstrapService).toBe("function");
      expect(typeof memoryBarrel.CoryRetriever).toBe("function");
      expect(typeof memoryBarrel.CoryContextAssembler).toBe("function");
      expect(typeof memoryBarrel.CoryMemoryStore).toBe("function");
      expect(typeof memoryBarrel.MemoryOrchestrator).toBe("function");
      expect(typeof memoryBarrel.listMemoryFiles).toBe("function");
      expect(typeof memoryBarrel.readAgentMemoryFile).toBe("function");
    });
  });

  describe("approval domain barrel (src/plugin-sdk/approval.ts)", () => {
    it("exports approval runtime contracts and CoreHub capability consent ledger", () => {
      expect(typeof approvalBarrel.CapabilityConsentLedger).toBe("function");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("network");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("filesystem");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("shell");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("credentials");
      expect(approvalBarrel.COREHUB_CAPABILITIES).toContain("webhook");
      expect(typeof approvalBarrel.DEFAULT_EXEC_APPROVAL_TIMEOUT_MS).toBe("number");
      expect(typeof approvalBarrel.DEFAULT_PLUGIN_APPROVAL_TIMEOUT_MS).toBe("number");
    });
  });

  describe("root package.json subpath exports", () => {
    it("declares all 5 thematic domain barrels in package.json exports mapping", () => {
      const pkgPath = path.resolve(process.cwd(), "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const exportsMap = pkg.exports;

      expect(exportsMap).toBeDefined();
      expect(exportsMap["./plugin-sdk/channel"]).toBeDefined();
      expect(exportsMap["./plugin-sdk/provider"]).toBeDefined();
      expect(exportsMap["./plugin-sdk/tool"]).toBeDefined();
      expect(exportsMap["./plugin-sdk/memory"]).toBeDefined();
      expect(exportsMap["./plugin-sdk/approval"]).toBeDefined();

      expect(exportsMap["./plugin-sdk/channel"].default).toBe("./dist/plugin-sdk/channel.js");
      expect(exportsMap["./plugin-sdk/provider"].default).toBe("./dist/plugin-sdk/provider.js");
      expect(exportsMap["./plugin-sdk/tool"].default).toBe("./dist/plugin-sdk/tool.js");
      expect(exportsMap["./plugin-sdk/memory"].default).toBe("./dist/plugin-sdk/memory.js");
      expect(exportsMap["./plugin-sdk/approval"].default).toBe("./dist/plugin-sdk/approval.js");

      expect(exportsMap["./plugin-sdk/channel"].types).toBe("./dist/plugin-sdk/channel.d.ts");
      expect(exportsMap["./plugin-sdk/provider"].types).toBe("./dist/plugin-sdk/provider.d.ts");
      expect(exportsMap["./plugin-sdk/tool"].types).toBe("./dist/plugin-sdk/tool.d.ts");
      expect(exportsMap["./plugin-sdk/memory"].types).toBe("./dist/plugin-sdk/memory.d.ts");
      expect(exportsMap["./plugin-sdk/approval"].types).toBe("./dist/plugin-sdk/approval.d.ts");
    });
  });
});
