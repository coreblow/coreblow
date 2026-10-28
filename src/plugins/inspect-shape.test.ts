import { describe, expect, it } from "vitest";
import { buildPluginShapeSummary } from "./inspect-shape.js";
import type { PluginRecord, PluginRegistry } from "./registry.js";

describe("inspect-shape", () => {
  const dummyReport: Pick<PluginRegistry, "hooks" | "typedHooks" | "tools" | "gatewayMethodDescriptors"> = {
    hooks: [],
    typedHooks: [],
    tools: [],
    gatewayMethodDescriptors: [],
  };

  it("derives hook-only shape when plugin only provides hooks", () => {
    const plugin: PluginRecord = {
      id: "hook-plugin",
      name: "Hook Plugin",
      source: "/test",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      toolNames: [],
      hookNames: ["before_agent_start"],
      channelIds: [],
      cliBackendIds: [],
      providerIds: [],
      speechProviderIds: [],
      mediaUnderstandingProviderIds: [],
      imageGenerationProviderIds: [],
      videoGenerationProviderIds: [],
      webSearchProviderIds: [],
      gatewayMethods: [],
      cliCommands: [],
      services: [],
      commands: [],
      httpRoutes: 0,
      hookCount: 1,
      configSchema: false,
    };

    const summary = buildPluginShapeSummary({
      plugin,
      report: {
        ...dummyReport,
        typedHooks: [
          {
            pluginId: "hook-plugin",
            hookName: "before_agent_start",
            handler: () => {},
            source: "/test",
          },
        ],
      },
    });

    expect(summary.shape).toBe("hook-only");
    expect(summary.capabilityMode).toBe("none");
    expect(summary.usesLegacyBeforeAgentStart).toBe(true);
  });

  it("derives plain-capability shape when plugin provides exactly one capability", () => {
    const plugin: PluginRecord = {
      id: "channel-plugin",
      name: "Channel Plugin",
      source: "/test",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      toolNames: [],
      hookNames: [],
      channelIds: ["custom-chan"],
      cliBackendIds: [],
      providerIds: [],
      speechProviderIds: [],
      mediaUnderstandingProviderIds: [],
      imageGenerationProviderIds: [],
      videoGenerationProviderIds: [],
      webSearchProviderIds: [],
      gatewayMethods: [],
      cliCommands: [],
      services: [],
      commands: [],
      httpRoutes: 0,
      hookCount: 0,
      configSchema: false,
    };

    const summary = buildPluginShapeSummary({
      plugin,
      report: dummyReport,
    });

    expect(summary.shape).toBe("plain-capability");
    expect(summary.capabilityMode).toBe("plain");
    expect(summary.capabilities).toHaveLength(1);
    expect(summary.capabilities[0]?.kind).toBe("channel");
  });

  it("derives hybrid-capability shape when plugin provides multiple capabilities", () => {
    const plugin: PluginRecord = {
      id: "multi-plugin",
      name: "Multi Plugin",
      source: "/test",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      toolNames: [],
      hookNames: [],
      channelIds: ["custom-chan"],
      cliBackendIds: [],
      providerIds: ["custom-provider"],
      speechProviderIds: [],
      mediaUnderstandingProviderIds: [],
      imageGenerationProviderIds: [],
      videoGenerationProviderIds: [],
      webSearchProviderIds: [],
      gatewayMethods: [],
      cliCommands: [],
      services: [],
      commands: [],
      httpRoutes: 0,
      hookCount: 0,
      configSchema: false,
    };

    const summary = buildPluginShapeSummary({
      plugin,
      report: dummyReport,
    });

    expect(summary.shape).toBe("hybrid-capability");
    expect(summary.capabilityMode).toBe("hybrid");
    expect(summary.capabilityCount).toBe(2);
  });
});
