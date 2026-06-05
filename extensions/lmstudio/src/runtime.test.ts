import { describe, expect, it } from "vitest";
import { CUSTOM_LOCAL_AUTH_MARKER } from "coreblow/plugin-sdk/provider-auth";
import { LMSTUDIO_LOCAL_API_KEY_PLACEHOLDER } from "./defaults.js";
import {
  buildLmstudioAuthHeaders,
  resolveLmstudioConfiguredApiKey,
  resolveLmstudioProviderHeaders,
} from "./runtime.js";

describe("lmstudio runtime auth", () => {
  it("builds bearer auth headers only for real keys", () => {
    expect(buildLmstudioAuthHeaders({ apiKey: "real-key", json: true })).toEqual({
      Authorization: "Bearer real-key",
      "Content-Type": "application/json",
    });
    expect(buildLmstudioAuthHeaders({ apiKey: LMSTUDIO_LOCAL_API_KEY_PLACEHOLDER })).toBeUndefined();
    expect(buildLmstudioAuthHeaders({ apiKey: CUSTOM_LOCAL_AUTH_MARKER })).toBeUndefined();
  });

  it("lets configured Authorization headers win over bearer auth", () => {
    expect(
      buildLmstudioAuthHeaders({
        apiKey: "real-key",
        headers: {
          Authorization: "Bearer old",
          "X-LM-Studio": "1",
        },
      }),
    ).toEqual({
      Authorization: "Bearer real-key",
      "X-LM-Studio": "1",
    });
  });

  it("resolves string env-template api keys from provider config", async () => {
    await expect(
      resolveLmstudioConfiguredApiKey({
        config: {
          models: {
            providers: {
              lmstudio: {
                apiKey: "${LM_API_TOKEN}",
                baseUrl: "http://localhost:1234/v1",
                models: [],
              },
            },
          },
        },
        env: { LM_API_TOKEN: "template-key" },
      }),
    ).resolves.toBe("template-key");
  });

  it("sanitizes provider headers to non-empty strings", async () => {
    await expect(
      resolveLmstudioProviderHeaders({
        headers: {
          Authorization: " Bearer configured ",
          Empty: " ",
          Number: 1,
        },
      }),
    ).resolves.toEqual({
      Authorization: "Bearer configured",
    });
  });
});
