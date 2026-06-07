import { describe, expect, it, vi } from "vitest";

describe("amazon-bedrock lazy imports", () => {
  it("registers the setup entry without loading the Bedrock control-plane SDK", async () => {
    vi.doMock("@aws-sdk/client-bedrock", () => {
      throw new Error("Bedrock SDK should not load during setup registration");
    });
    const { default: setupPlugin } = await import("./setup-api.js");
    const providers: Array<{
      id: string;
      resolveConfigApiKey?: (params: { env: NodeJS.ProcessEnv }) => string | undefined;
    }> = [];

    setupPlugin.register({
      registerProvider(provider: {
        id: string;
        resolveConfigApiKey?: (params: { env: NodeJS.ProcessEnv }) => string | undefined;
      }) {
        providers.push(provider);
      },
    } as never);

    expect(providers.map((provider) => provider.id)).toEqual(["amazon-bedrock"]);
    expect(providers[0]?.resolveConfigApiKey?.({ env: { AWS_PROFILE: "default" } })).toBe(
      "AWS_PROFILE",
    );
    vi.doUnmock("@aws-sdk/client-bedrock");
  });
});
