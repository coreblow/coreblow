import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { defineSingleProviderPluginEntry } from "coreblow/plugin-sdk/provider-entry";
import {
  applyQwenConfig,
  applyQwenConfigCn,
  applyQwenStandardConfig,
  applyQwenStandardConfigCn,
  QWEN_DEFAULT_MODEL_REF,
} from "./onboard.js";
import { buildQwenMediaUnderstandingProvider } from "./media-understanding-provider.js";
import {
  applyQwenNativeStreamingUsageCompat,
  buildQwenModelCatalogForBaseUrl,
  QWEN_36_PLUS_MODEL_ID,
} from "./models.js";
import { buildQwenProvider } from "./provider-catalog.js";
import { wrapQwenProviderStream } from "./stream.js";
import { buildQwenVideoGenerationProvider } from "./video-generation-provider.js";

const PROVIDER_ID = "qwen";

function normalizeQwenProviderConfig(params: {
  providerConfig: ModelProviderConfig;
}): ModelProviderConfig | undefined {
  const models = params.providerConfig.models;
  if (!Array.isArray(models)) {
    return undefined;
  }
  const allowedModelIds = new Set(
    buildQwenModelCatalogForBaseUrl(params.providerConfig.baseUrl).map((model) => model.id),
  );
  if (allowedModelIds.has(QWEN_36_PLUS_MODEL_ID)) {
    return undefined;
  }
  const filteredModels = models.filter((model) => model.id !== QWEN_36_PLUS_MODEL_ID);
  if (filteredModels.length === models.length) {
    return undefined;
  }
  return {
    ...params.providerConfig,
    models: filteredModels,
  };
}

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "Qwen Provider",
  description: "Bundled Qwen Cloud provider plugin",
  provider: {
    label: "Qwen Cloud",
    aliases: ["qwencloud", "modelstudio", "dashscope"],
    docsPath: "/providers/qwen",
    envVars: ["QWEN_API_KEY", "MODELSTUDIO_API_KEY", "DASHSCOPE_API_KEY"],
    auth: [
      {
        methodId: "standard-api-key-cn",
        label: "Standard API Key for China (pay-as-you-go)",
        hint: "Endpoint: dashscope.aliyuncs.com",
        optionKey: "modelstudioStandardApiKeyCn",
        flagName: "--modelstudio-standard-api-key-cn",
        envVar: "QWEN_API_KEY",
        promptMessage: "Enter Qwen Cloud API key (China)",
        defaultModel: QWEN_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyQwenStandardConfigCn(cfg),
        noteMessage: [
          "Get your API key at: https://bailian.console.aliyun.com/",
          "Endpoint: dashscope.aliyuncs.com/compatible-mode/v1",
          "Models: qwen3.6-plus, qwen3.5-plus, qwen3-coder-plus, etc.",
        ].join("\n"),
        noteTitle: "Qwen Cloud Standard (China)",
        wizard: {
          choiceHint: "Endpoint: dashscope.aliyuncs.com",
          groupLabel: "Qwen Cloud",
          groupHint: "Standard / Coding Plan (CN / Global)",
        },
      },
      {
        methodId: "standard-api-key",
        label: "Standard API Key for Global/Intl (pay-as-you-go)",
        hint: "Endpoint: dashscope-intl.aliyuncs.com",
        optionKey: "modelstudioStandardApiKey",
        flagName: "--modelstudio-standard-api-key",
        envVar: "QWEN_API_KEY",
        promptMessage: "Enter Qwen Cloud API key (Global/Intl)",
        defaultModel: QWEN_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyQwenStandardConfig(cfg),
        noteMessage: [
          "Get your API key at: https://modelstudio.console.alibabacloud.com/",
          "Endpoint: dashscope-intl.aliyuncs.com/compatible-mode/v1",
          "Models: qwen3.6-plus, qwen3.5-plus, qwen3-coder-plus, etc.",
        ].join("\n"),
        noteTitle: "Qwen Cloud Standard (Global/Intl)",
        wizard: {
          choiceHint: "Endpoint: dashscope-intl.aliyuncs.com",
          groupLabel: "Qwen Cloud",
          groupHint: "Standard / Coding Plan (CN / Global)",
        },
      },
      {
        methodId: "api-key-cn",
        label: "Coding Plan API Key for China (subscription)",
        hint: "Endpoint: coding.dashscope.aliyuncs.com",
        optionKey: "modelstudioApiKeyCn",
        flagName: "--modelstudio-api-key-cn",
        envVar: "QWEN_API_KEY",
        promptMessage: "Enter Qwen Cloud Coding Plan API key (China)",
        defaultModel: QWEN_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyQwenConfigCn(cfg),
        noteMessage: [
          "Get your API key at: https://bailian.console.aliyun.com/",
          "Endpoint: coding.dashscope.aliyuncs.com",
          "Models: qwen3.5-plus, glm-5, kimi-k2.5, MiniMax-M2.5, etc.",
        ].join("\n"),
        noteTitle: "Qwen Cloud Coding Plan (China)",
        wizard: {
          choiceHint: "Endpoint: coding.dashscope.aliyuncs.com",
          groupLabel: "Qwen Cloud",
          groupHint: "Standard / Coding Plan (CN / Global)",
        },
      },
      {
        methodId: "api-key",
        label: "Coding Plan API Key for Global/Intl (subscription)",
        hint: "Endpoint: coding-intl.dashscope.aliyuncs.com",
        optionKey: "modelstudioApiKey",
        flagName: "--modelstudio-api-key",
        envVar: "QWEN_API_KEY",
        promptMessage: "Enter Qwen Cloud Coding Plan API key (Global/Intl)",
        defaultModel: QWEN_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyQwenConfig(cfg),
        noteMessage: [
          "Get your API key at: https://bailian.console.aliyun.com/",
          "Endpoint: coding-intl.dashscope.aliyuncs.com",
          "Models: qwen3.5-plus, glm-5, kimi-k2.5, MiniMax-M2.5, etc.",
        ].join("\n"),
        noteTitle: "Qwen Cloud Coding Plan (Global/Intl)",
        wizard: {
          choiceHint: "Endpoint: coding-intl.dashscope.aliyuncs.com",
          groupLabel: "Qwen Cloud",
          groupHint: "Standard / Coding Plan (CN / Global)",
        },
      },
    ],
    catalog: {
      buildProvider: buildQwenProvider,
      allowExplicitBaseUrl: true,
    },
    applyNativeStreamingUsageCompat: ({ providerConfig }) =>
      applyQwenNativeStreamingUsageCompat(providerConfig),
    normalizeConfig: ({ providerConfig }) => normalizeQwenProviderConfig({ providerConfig }),
    wrapStreamFn: wrapQwenProviderStream,
  },
  register(api) {
    api.registerMediaUnderstandingProvider(buildQwenMediaUnderstandingProvider());
    api.registerVideoGenerationProvider(buildQwenVideoGenerationProvider());
  },
});
