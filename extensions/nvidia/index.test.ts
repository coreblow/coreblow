import { describe, expect, it } from "vitest";
import { capturePluginRegistration } from "../../src/plugins/captured-registration.js";
import plugin from "./index.js";

function registerNvidiaProvider() {
  const captured = capturePluginRegistration(plugin);
  const provider = captured.providers[0];
  if (!provider) {
    throw new Error("expected NVIDIA provider");
  }
  return provider;
}

describe("nvidia provider hooks", () => {
  it("registers the nvidia provider with correct metadata", () => {
    const provider = registerNvidiaProvider();

    expect(provider.id).toBe("nvidia");
    expect(provider.label).toBe("NVIDIA");
    expect(provider.docsPath).toBe("/providers/nvidia");
    expect(provider.envVars).toEqual(["NVIDIA_API_KEY"]);
  });

  it("keeps nvidia auth setup metadata aligned", () => {
    const provider = registerNvidiaProvider();

    expect(
      provider.auth.map((method) => ({
        id: method.id,
        label: method.label,
        hint: method.hint,
        choiceId: method.wizard?.choiceId,
        groupId: method.wizard?.groupId,
        groupLabel: method.wizard?.groupLabel,
        groupHint: method.wizard?.groupHint,
      })),
    ).toEqual([
      {
        id: "api-key",
        label: "NVIDIA API key",
        hint: "Direct API key",
        choiceId: "nvidia-api-key",
        groupId: "nvidia",
        groupLabel: "NVIDIA",
        groupHint: "Direct API key",
      },
    ]);
  });

  it("keeps nvidia wizard setup metadata aligned", () => {
    const provider = registerNvidiaProvider();

    expect(provider.wizard?.setup).toStrictEqual({
      choiceId: "nvidia-api-key",
      choiceLabel: "NVIDIA API key",
      groupId: "nvidia",
      groupLabel: "NVIDIA",
      groupHint: "Direct API key",
      methodId: "api-key",
      modelSelection: {
        promptWhenAuthChoiceProvided: true,
        allowKeepCurrent: false,
      },
    });
  });

  it("keeps nvidia model picker metadata aligned", () => {
    const provider = registerNvidiaProvider();

    expect(provider.wizard?.modelPicker).toStrictEqual({
      label: "NVIDIA (custom)",
      hint: "Use NVIDIA-hosted open models",
      methodId: "api-key",
    });
  });

  it("surfaces the bundled NVIDIA models via augmentModelCatalog", async () => {
    const provider = registerNvidiaProvider();

    const entries = await provider.augmentModelCatalog?.({
      env: process.env,
      config: {},
      entries: [],
    } as never);

    expect(entries?.map((entry) => entry.id)).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "moonshotai/kimi-k2.5",
      "minimaxai/minimax-m2.5",
      "z-ai/glm5",
    ]);
    expect(entries?.every((entry) => entry.provider === "nvidia")).toBe(true);
  });
});
