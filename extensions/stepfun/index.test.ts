import { describe, expect, it } from "vitest";
import { createCapturedPluginRegistration } from "../../test/helpers/extensions/plugin-registration.js";
import plugin from "./index.js";
import {
  buildStepFunPlanProvider,
  buildStepFunProvider,
  STEPFUN_PLAN_CN_BASE_URL,
  STEPFUN_PLAN_INTL_BASE_URL,
  STEPFUN_PLAN_PROVIDER_ID,
  STEPFUN_PROVIDER_ID,
  STEPFUN_STANDARD_CN_BASE_URL,
  STEPFUN_STANDARD_INTL_BASE_URL,
} from "./provider-catalog.js";

function captureProviders() {
  const captured = createCapturedPluginRegistration();
  plugin.register(captured.api);
  return captured.providers;
}

function createCatalogContext(params: {
  apiKey?: string;
  profileId?: string;
  envApiKey?: string;
  providerBaseUrls?: Record<string, string>;
}) {
  return {
    config: {
      models: {
        providers: Object.fromEntries(
          Object.entries(params.providerBaseUrls ?? {}).map(([providerId, baseUrl]) => [
            providerId,
            { baseUrl, models: [] },
          ]),
        ),
      },
    },
    env: params.envApiKey ? { STEPFUN_API_KEY: params.envApiKey } : {},
    resolveProviderAuth: () => ({
      apiKey: params.apiKey,
      mode: params.apiKey ? "api_key" : "none",
      source: params.profileId ? "profile" : "none",
      profileId: params.profileId,
    }),
    resolveProviderApiKey: () => ({ apiKey: params.apiKey }),
  };
}

describe("stepfun provider plugin", () => {
  it("registers standard and Step Plan providers", () => {
    const providers = captureProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      STEPFUN_PROVIDER_ID,
      STEPFUN_PLAN_PROVIDER_ID,
    ]);
    expect(providers[0]).toMatchObject({
      label: "StepFun",
      docsPath: "/providers/stepfun",
      envVars: ["STEPFUN_API_KEY"],
    });
    expect(providers[1]).toMatchObject({
      label: "StepFun Step Plan",
      docsPath: "/providers/stepfun",
      envVars: ["STEPFUN_API_KEY"],
    });
    expect(providers[0]?.auth.map((entry) => entry.id)).toEqual([
      "standard-api-key-cn",
      "standard-api-key-intl",
    ]);
    expect(providers[1]?.auth.map((entry) => entry.id)).toEqual([
      "plan-api-key-cn",
      "plan-api-key-intl",
    ]);
  });

  it("builds static standard and Step Plan catalogs", () => {
    expect(buildStepFunProvider()).toMatchObject({
      baseUrl: STEPFUN_STANDARD_INTL_BASE_URL,
      api: "openai-completions",
      models: [
        {
          id: "step-3.5-flash",
          api: "openai-completions",
          reasoning: true,
          contextWindow: 262144,
          maxTokens: 65536,
        },
      ],
    });

    expect(buildStepFunPlanProvider().models.map((model) => model.id)).toEqual([
      "step-3.5-flash",
      "step-3.5-flash-2603",
    ]);
    expect(buildStepFunPlanProvider(STEPFUN_PLAN_CN_BASE_URL).baseUrl).toBe(
      STEPFUN_PLAN_CN_BASE_URL,
    );
  });

  it("resolves region-specific catalog base URLs from profile or explicit config", async () => {
    const [standard, plan] = captureProviders();

    await expect(
      standard?.catalog?.run(
        createCatalogContext({
          apiKey: "sk-test",
          profileId: "stepfun:cn",
        }) as never,
      ),
    ).resolves.toMatchObject({
      provider: {
        baseUrl: STEPFUN_STANDARD_CN_BASE_URL,
        apiKey: "sk-test",
      },
    });

    await expect(
      plan?.catalog?.run(
        createCatalogContext({
          apiKey: "sk-test",
          providerBaseUrls: { [STEPFUN_PROVIDER_ID]: STEPFUN_STANDARD_INTL_BASE_URL },
        }) as never,
      ),
    ).resolves.toMatchObject({
      provider: {
        baseUrl: STEPFUN_PLAN_INTL_BASE_URL,
        apiKey: "sk-test",
      },
    });
  });
});
