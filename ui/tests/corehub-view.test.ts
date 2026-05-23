import { describe, expect, it } from "vitest";
import {
  DEFAULT_COREHUB_REGISTRY_URL,
  coreBlowGatewayHttpBaseUrl,
  coreHubAdminUrl,
  coreHubApiUrl,
  coreHubDirectoryUrl,
  coreHubGatewayProxyUrl,
  normalizeCoreHubRegistryUrl,
} from "../src/ui/views/corehub.ts";

describe("CoreHub view URL helpers", () => {
  it("normalizes empty or invalid registry URLs to the production CoreHub route", () => {
    expect(normalizeCoreHubRegistryUrl("")).toBe(DEFAULT_COREHUB_REGISTRY_URL);
    expect(normalizeCoreHubRegistryUrl("not a url")).toBe(DEFAULT_COREHUB_REGISTRY_URL);
  });

  it("removes trailing slashes from valid registry URLs", () => {
    expect(normalizeCoreHubRegistryUrl("https://coreblow.com/corehub/")).toBe("https://coreblow.com/corehub");
  });

  it("builds admin and API URLs from the CoreHub registry route", () => {
    expect(coreHubDirectoryUrl("https://coreblow.com/corehub/")).toBe("https://coreblow.com/corehub");
    expect(coreHubAdminUrl("https://coreblow.com/corehub/")).toBe("https://coreblow.com/corehub/admin");
    expect(coreHubApiUrl("https://coreblow.com/corehub/", "/admin/status")).toBe(
      "https://coreblow.com/corehub/api/v2/admin/status",
    );
  });

  it("builds CoreBlow Gateway proxy URLs from websocket settings", () => {
    expect(coreBlowGatewayHttpBaseUrl("ws://127.0.0.1:18789")).toBe("http://127.0.0.1:18789");
    expect(coreBlowGatewayHttpBaseUrl("wss://gateway.example/ws")).toBe("https://gateway.example");
    expect(coreHubGatewayProxyUrl("ws://127.0.0.1:18789", "/admin/status")).toBe(
      "http://127.0.0.1:18789/api/corehub/v2/admin/status",
    );
  });
});
