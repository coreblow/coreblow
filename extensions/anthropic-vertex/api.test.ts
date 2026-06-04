import { describe, expect, it } from "vitest";
import {
  createAnthropicVertexStreamFn,
  createAnthropicVertexStreamFnForModel,
  mergeImplicitAnthropicVertexProvider,
  resolveImplicitAnthropicVertexProvider,
} from "./api.js";

describe("anthropic-vertex api facade", () => {
  it("exports lazy stream factory facades", () => {
    expect(createAnthropicVertexStreamFn).toBeTypeOf("function");
    expect(createAnthropicVertexStreamFnForModel).toBeTypeOf("function");
  });

  it("merges implicit provider models with explicit overrides", () => {
    const implicit = resolveImplicitAnthropicVertexProvider({
      env: {
        ANTHROPIC_VERTEX_USE_GCP_METADATA: "true",
        GOOGLE_CLOUD_LOCATION: "us-east5",
      } as NodeJS.ProcessEnv,
    });
    if (!implicit) {
      throw new Error("expected implicit provider");
    }

    const merged = mergeImplicitAnthropicVertexProvider({
      implicit,
      existing: {
        baseUrl: "https://proxy.example.test",
        api: "anthropic-messages",
        headers: { "x-test": "1" },
        models: [],
      },
    });

    expect(merged.baseUrl).toBe("https://proxy.example.test");
    expect(merged.headers).toEqual({ "x-test": "1" });
    expect(merged.models?.map((model) => model.id)).toEqual([
      "claude-opus-4-6",
      "claude-sonnet-4-6",
    ]);
  });
});
