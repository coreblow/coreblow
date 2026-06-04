import type { CoreBlowConfig, CoreBlowPluginApi } from "coreblow/plugin-sdk/core";
import {
  mergeImplicitMantleProvider,
  resolveImplicitMantleProvider,
  resolveMantleBearerToken,
  resolveMantleRuntimeBearerToken,
} from "./discovery.js";
import { createMantleAnthropicStreamFn } from "./mantle-anthropic.runtime.js";

const PROVIDER_ID = "amazon-bedrock-mantle";

type BedrockMantlePluginConfig = {
  discovery?: {
    enabled?: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveCurrentPluginConfig(config: CoreBlowConfig | undefined) {
  const runtimeConfig = config?.plugins?.entries?.[PROVIDER_ID]?.config;
  return isRecord(runtimeConfig) ? (runtimeConfig as BedrockMantlePluginConfig) : undefined;
}

export function registerBedrockMantlePlugin(api: CoreBlowPluginApi): void {
  api.registerProvider({
    id: PROVIDER_ID,
    label: "Amazon Bedrock Mantle (OpenAI-compatible)",
    docsPath: "/providers/bedrock-mantle",
    auth: [],
    catalog: {
      order: "simple",
      run: async (ctx) => {
        const implicit = await resolveImplicitMantleProvider({
          env: ctx.env,
          pluginConfig: resolveCurrentPluginConfig(ctx.config),
        });
        if (!implicit) {
          return null;
        }
        return {
          provider: mergeImplicitMantleProvider({
            existing: ctx.config.models?.providers?.[PROVIDER_ID],
            implicit,
          }),
        };
      },
    },
    resolveConfigApiKey: ({ env }) =>
      resolveMantleBearerToken(env) ? "env:AWS_BEARER_TOKEN_BEDROCK" : undefined,
    prepareRuntimeAuth: async ({ apiKey, env }) =>
      await resolveMantleRuntimeBearerToken({
        apiKey,
        env,
      }),
    createStreamFn: ({ model }) =>
      model.api === "anthropic-messages" ? createMantleAnthropicStreamFn() : undefined,
  });
}
