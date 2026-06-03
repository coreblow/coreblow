import type { StreamFn } from "@mariozechner/pi-agent-core";
import { capturePluginRegistration } from "../../src/plugins/captured-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

function registerProvider() {
  const captured = capturePluginRegistration(plugin);
  const provider = captured.providers[0];
  if (!provider) {
    throw new Error("expected Cloudflare AI Gateway provider");
  }
  expect(provider.id).toBe("cloudflare-ai-gateway");
  return provider;
}

describe("cloudflare-ai-gateway plugin", () => {
  it("registers a stream wrapper that strips Anthropic thinking assistant prefill", () => {
    const provider = registerProvider();
    expect(provider.wrapStreamFn).toBeTypeOf("function");
    if (!provider.wrapStreamFn) {
      throw new Error("expected Cloudflare AI Gateway stream wrapper");
    }

    let capturedPayload: Record<string, unknown> | undefined;
    const baseStreamFn: StreamFn = (model, _context, options) => {
      const payload: Record<string, unknown> = {
        thinking: { type: "enabled", budget_tokens: 1024 },
        messages: [
          { role: "user", content: "Return JSON." },
          { role: "assistant", content: "{" },
        ],
      };
      options?.onPayload?.(payload as never, model as never);
      capturedPayload = payload;
      return {} as ReturnType<StreamFn>;
    };

    const wrapped = provider.wrapStreamFn({
      provider: "cloudflare-ai-gateway",
      modelId: "claude-sonnet-4-5",
      model: { api: "anthropic-messages" },
      streamFn: baseStreamFn,
    } as never);
    if (!wrapped) {
      throw new Error("expected Cloudflare AI Gateway wrapped stream function");
    }

    void wrapped(
      { provider: "cloudflare-ai-gateway", api: "anthropic-messages" } as never,
      {} as never,
      {},
    );

    expect(capturedPayload?.messages).toEqual([{ role: "user", content: "Return JSON." }]);
  });
});
