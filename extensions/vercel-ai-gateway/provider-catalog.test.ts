import { describe, expect, it } from "vitest";
import {
  discoverVercelAiGatewayModels,
  getStaticVercelAiGatewayModelCatalog,
  VERCEL_AI_GATEWAY_BASE_URL,
} from "./api.js";
import {
  buildStaticVercelAiGatewayProvider,
  buildVercelAiGatewayProvider,
} from "./provider-catalog.js";

describe("vercel ai gateway provider catalog", () => {
  it("builds the bundled Vercel AI Gateway defaults", async () => {
    const provider = await buildVercelAiGatewayProvider();

    expect(provider).toStrictEqual({
      baseUrl: VERCEL_AI_GATEWAY_BASE_URL,
      api: "anthropic-messages",
      models: getStaticVercelAiGatewayModelCatalog(),
    });
  });

  it("builds an offline static provider catalog", () => {
    expect(buildStaticVercelAiGatewayProvider()).toStrictEqual({
      baseUrl: VERCEL_AI_GATEWAY_BASE_URL,
      api: "anthropic-messages",
      models: getStaticVercelAiGatewayModelCatalog(),
    });
  });

  it("uses the static catalog in test mode discovery", async () => {
    await expect(discoverVercelAiGatewayModels()).resolves.toStrictEqual(
      getStaticVercelAiGatewayModelCatalog(),
    );
  });
});
