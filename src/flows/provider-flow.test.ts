import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveManifestProviderSetupFlowContributions,
  resolveProviderSetupFlowContributions,
  resolveProviderModelPickerFlowContributions,
} from "./provider-flow.js";

const resolveManifestProviderAuthChoices = vi.hoisted(() => vi.fn(() => []));
const resolveProviderWizardOptions = vi.hoisted(() => vi.fn(() => []));
const resolveProviderModelPickerEntries = vi.hoisted(() => vi.fn(() => []));
const resolvePluginProviders = vi.hoisted(() => vi.fn(() => []));

vi.mock("../plugins/provider-auth-choices.js", () => ({
  resolveManifestProviderAuthChoices,
}));

vi.mock("../plugins/provider-wizard.js", () => ({
  resolveProviderWizardOptions,
  resolveProviderModelPickerEntries,
}));

vi.mock("../plugins/providers.runtime.js", () => ({
  resolvePluginProviders,
}));

describe("provider flow", () => {
  beforeEach(() => {
    resolveManifestProviderAuthChoices.mockReset();
    resolveManifestProviderAuthChoices.mockReturnValue([]);
    resolveProviderWizardOptions.mockReset();
    resolveProviderWizardOptions.mockReturnValue([]);
    resolveProviderModelPickerEntries.mockReset();
    resolveProviderModelPickerEntries.mockReturnValue([]);
    resolvePluginProviders.mockReset();
    resolvePluginProviders.mockReturnValue([]);
  });

  it("uses bundled compat when resolving docs for manifest-backed setup contributions", () => {
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "sglang",
        providerId: "sglang",
        methodId: "custom",
        choiceId: "provider-plugin:sglang:custom",
        choiceLabel: "SGLang",
      },
    ] as never);
    resolvePluginProviders.mockReturnValue([
      { id: "sglang", docsPath: "/providers/sglang" },
    ] as never);

    const contributions = resolveManifestProviderSetupFlowContributions({
      config: {},
      workspaceDir: "/tmp/workspace",
      env: process.env,
    });

    expect(resolvePluginProviders).toHaveBeenCalledWith({
      config: {},
      workspaceDir: "/tmp/workspace",
      env: process.env,
      bundledProviderAllowlistCompat: true,
      bundledProviderVitestCompat: true,
    });
    expect(contributions[0]?.option.docs).toEqual({ path: "/providers/sglang" });
  });

  it("uses bundled compat when resolving docs for runtime model-picker contributions", () => {
    resolveProviderModelPickerEntries.mockReturnValue([
      {
        value: "provider-plugin:vllm:custom",
        label: "vLLM",
      },
    ] as never);
    resolvePluginProviders.mockReturnValue([{ id: "vllm", docsPath: "/providers/vllm" }] as never);

    const contributions = resolveProviderModelPickerFlowContributions({
      config: {},
      workspaceDir: "/tmp/workspace",
      env: process.env,
    });

    expect(resolvePluginProviders).toHaveBeenCalledWith({
      config: {},
      workspaceDir: "/tmp/workspace",
      env: process.env,
      bundledProviderAllowlistCompat: true,
      bundledProviderVitestCompat: true,
    });
    expect(contributions[0]?.option.docs).toEqual({ path: "/providers/vllm" });
  });

  it("surfaces manifest provider auth choices before setup runtime loads", () => {
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "anthropic",
        providerId: "anthropic",
        choiceId: "provider-plugin:anthropic:oauth",
        choiceLabel: "Anthropic OAuth",
      },
    ] as never);
    resolveProviderWizardOptions.mockReturnValue([
      {
        value: "provider-plugin:anthropic:key",
        label: "Anthropic key",
        groupId: "anthropic",
        groupLabel: "Anthropic",
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions();

    expect(contributions.map((entry) => entry.option.value)).toContain(
      "provider-plugin:anthropic:oauth",
    );
  });

  it("prefers manifest setup contributions over duplicate install-catalog entries", () => {
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "openai",
        providerId: "openai",
        choiceId: "provider-plugin:openai:key",
        choiceLabel: "OpenAI manifest",
      },
    ] as never);
    resolveProviderWizardOptions.mockReturnValue([
      {
        value: "provider-plugin:openai:key",
        label: "OpenAI runtime",
        groupId: "openai",
        groupLabel: "OpenAI",
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions();

    expect(contributions).toHaveLength(1);
    expect(contributions[0]?.source).toBe("manifest");
    expect(contributions[0]?.option.label).toBe("OpenAI manifest");
  });

  it("surfaces install-catalog provider choices when runtime setup options are absent", () => {
    resolveProviderWizardOptions.mockReturnValue([
      {
        value: "provider-plugin:vllm:custom",
        label: "vLLM",
        groupId: "vllm",
        groupLabel: "vLLM",
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions();

    expect(contributions[0]?.option.value).toBe("provider-plugin:vllm:custom");
    expect(contributions[0]?.source).toBe("runtime");
  });

  it("adds a fallback group when install-catalog entries omit group metadata", () => {
    resolveProviderWizardOptions.mockReturnValue([
      {
        value: "provider-plugin:localai:custom",
        label: "LocalAI",
        groupId: "localai",
        groupLabel: "LocalAI",
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions();

    expect(contributions[0]?.option.group).toEqual({ id: "localai", label: "LocalAI" });
  });

  it("hides install-catalog choices that cannot be enabled", () => {
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "fal",
        providerId: "fal",
        choiceId: "provider-plugin:fal:key",
        choiceLabel: "Fal",
        onboardingScopes: ["image-generation"],
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions({ scope: "text-inference" });

    expect(contributions).toHaveLength(0);
  });

  it("hides install-catalog choices outside a configured plugin allowlist", () => {
    resolveProviderWizardOptions.mockReturnValue([
      {
        value: "provider-plugin:fal:key",
        label: "Fal",
        groupId: "fal",
        groupLabel: "Fal",
        onboardingScopes: ["image-generation"],
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions({ scope: "text-inference" });

    expect(contributions).toHaveLength(0);
  });

  it("keeps setup contributions on cold metadata instead of runtime wizard options", () => {
    resolveManifestProviderAuthChoices.mockReturnValue([
      {
        pluginId: "deepinfra",
        providerId: "deepinfra",
        choiceId: "provider-plugin:deepinfra:key",
        choiceLabel: "DeepInfra",
      },
    ] as never);

    const contributions = resolveProviderSetupFlowContributions();

    expect(contributions[0]?.source).toBe("manifest");
  });

  it("keeps docs attached to runtime model-picker contributions", () => {
    resolveProviderModelPickerEntries.mockReturnValue([
      {
        value: "provider-plugin:deepinfra:key",
        label: "DeepInfra",
      },
    ] as never);
    resolvePluginProviders.mockReturnValue([
      { id: "deepinfra", docsPath: "/providers/deepinfra" },
    ] as never);

    const contributions = resolveProviderModelPickerFlowContributions();

    expect(contributions[0]?.option.docs).toEqual({ path: "/providers/deepinfra" });
  });
});
