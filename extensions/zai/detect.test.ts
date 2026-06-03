import { describe, expect, it } from "vitest";
import { detectZaiEndpoint } from "./detect.js";

type FetchResponse = { status: number; body?: unknown };

function makeFetch(map: Record<string, FetchResponse>) {
  return (async (url: string, init?: RequestInit) => {
    const rawBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    const modelId = typeof rawBody?.model === "string" ? rawBody.model : "";
    const entry = map[`${url}::${modelId}`] ?? map[url];
    if (!entry) {
      throw new Error(`unexpected url: ${url} model=${modelId}`);
    }

    return new Response(JSON.stringify(entry.body ?? {}), {
      status: entry.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("detectZaiEndpoint", () => {
  it("resolves preferred and fallback endpoints, then returns null when probes fail", async () => {
    const scenarios: Array<{
      endpoint?: "global" | "cn" | "coding-global" | "coding-cn";
      responses: Record<string, FetchResponse>;
      expected: { endpoint: string; modelId: string } | null;
    }> = [
      {
        responses: {
          "https://api.z.ai/api/paas/v4/chat/completions::glm-5": { status: 200 },
        },
        expected: { endpoint: "global", modelId: "glm-5" },
      },
      {
        responses: {
          "https://api.z.ai/api/paas/v4/chat/completions::glm-5": {
            status: 404,
            body: { error: { message: "not found" } },
          },
          "https://open.bigmodel.cn/api/paas/v4/chat/completions::glm-5": { status: 200 },
        },
        expected: { endpoint: "cn", modelId: "glm-5" },
      },
      {
        endpoint: "coding-global",
        responses: {
          "https://api.z.ai/api/coding/paas/v4/chat/completions::glm-5": {
            status: 404,
            body: { error: { message: "glm-5 unavailable" } },
          },
          "https://api.z.ai/api/coding/paas/v4/chat/completions::glm-4.7": { status: 200 },
        },
        expected: { endpoint: "coding-global", modelId: "glm-4.7" },
      },
      {
        endpoint: "coding-cn",
        responses: {
          "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions::glm-5": { status: 200 },
        },
        expected: { endpoint: "coding-cn", modelId: "glm-5" },
      },
      {
        responses: {
          "https://api.z.ai/api/paas/v4/chat/completions::glm-5": { status: 401 },
          "https://open.bigmodel.cn/api/paas/v4/chat/completions::glm-5": { status: 401 },
          "https://api.z.ai/api/coding/paas/v4/chat/completions::glm-5": { status: 401 },
          "https://api.z.ai/api/coding/paas/v4/chat/completions::glm-4.7": { status: 401 },
          "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions::glm-5": { status: 401 },
          "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions::glm-4.7": {
            status: 401,
          },
        },
        expected: null,
      },
    ];

    for (const scenario of scenarios) {
      const detected = await detectZaiEndpoint({
        apiKey: "sk-test",
        ...(scenario.endpoint ? { endpoint: scenario.endpoint } : {}),
        fetchFn: makeFetch(scenario.responses),
      });

      if (scenario.expected === null) {
        expect(detected).toBeNull();
      } else {
        expect(detected?.endpoint).toBe(scenario.expected.endpoint);
        expect(detected?.modelId).toBe(scenario.expected.modelId);
      }
    }
  });
});
