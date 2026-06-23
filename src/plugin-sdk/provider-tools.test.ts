import { describe, expect, it } from "vitest";
import {
  buildProviderToolCompatFamilyHooks,
  findOpenAIStrictSchemaViolations,
  inspectGeminiToolSchemas,
  inspectOpenAIToolSchemas,
  normalizeGeminiToolSchemas,
  normalizeOpenAIToolSchemas,
} from "./provider-tools.js";

describe("buildProviderToolCompatFamilyHooks", () => {
  it("covers the provider tool compat family matrix", () => {
    const cases = [
      {
        family: "gemini" as const,
        normalizeToolSchemas: normalizeGeminiToolSchemas,
        inspectToolSchemas: inspectGeminiToolSchemas,
      },
      {
        family: "openai" as const,
        normalizeToolSchemas: normalizeOpenAIToolSchemas,
        inspectToolSchemas: inspectOpenAIToolSchemas,
      },
    ];

    for (const testCase of cases) {
      const hooks = buildProviderToolCompatFamilyHooks(testCase.family);

      expect(hooks.normalizeToolSchemas).toBe(testCase.normalizeToolSchemas);
      expect(hooks.inspectToolSchemas).toBe(testCase.inspectToolSchemas);
    }
  });

  it("normalizes parameter-free and typed-object schemas for native OpenAI routes", () => {
    const hooks = buildProviderToolCompatFamilyHooks("openai");
    const tools = [
      { name: "ping", description: "", parameters: {} },
      { name: "exec", description: "", parameters: { type: "object" } },
    ] as never;

    const normalized = hooks.normalizeToolSchemas({
      provider: "openai",
      modelId: "gpt-5.4",
      modelApi: "openai-responses",
      model: {
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        id: "gpt-5.4",
      } as never,
      tools,
    });

    expect(normalized.map((tool) => tool.parameters)).toEqual([
      { type: "object", properties: {}, required: [], additionalProperties: false },
      { type: "object", properties: {}, required: [], additionalProperties: false },
    ]);
    expect(
      hooks.inspectToolSchemas({
        provider: "openai",
        modelId: "gpt-5.4",
        modelApi: "openai-responses",
        model: {
          provider: "openai",
          api: "openai-responses",
          baseUrl: "https://api.openai.com/v1",
          id: "gpt-5.4",
        } as never,
        tools,
      }),
    ).toStrictEqual([]);
  });

  it("preserves permissive OpenAI schemas for strict false transport fallback", () => {
    const hooks = buildProviderToolCompatFamilyHooks("openai");
    const permissiveParameters = {
      type: "object",
      properties: {
        action: { type: "string" },
        schedule: { type: "string" },
      },
      required: ["action"],
      additionalProperties: true,
    };
    const permissiveTool = {
      name: "cron",
      description: "",
      parameters: permissiveParameters,
    } as never;

    const normalized = hooks.normalizeToolSchemas({
      provider: "openai-codex",
      modelId: "gpt-5.4",
      modelApi: "openai-codex-responses",
      model: {
        provider: "openai-codex",
        api: "openai-codex-responses",
        baseUrl: "https://chatgpt.com/backend-api",
        id: "gpt-5.4",
      } as never,
      tools: [permissiveTool],
    });

    expect(normalized[0]?.parameters).toEqual(permissiveParameters);
    expect(findOpenAIStrictSchemaViolations(permissiveParameters, "cron.parameters")).toEqual(
      expect.arrayContaining([
        "cron.parameters.required.schedule",
        "cron.parameters.additionalProperties",
      ]),
    );
    expect(
      hooks.inspectToolSchemas({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        modelApi: "openai-codex-responses",
        model: {
          provider: "openai-codex",
          api: "openai-codex-responses",
          baseUrl: "https://chatgpt.com/backend-api",
          id: "gpt-5.4",
        } as never,
        tools: [permissiveTool],
      }),
    ).toStrictEqual([]);
  });

  it("skips OpenAI strict-tool normalization on non-native routes", () => {
    const hooks = buildProviderToolCompatFamilyHooks("openai");
    const tools = [{ name: "ping", description: "", parameters: {} }] as never;

    expect(
      hooks.normalizeToolSchemas({
        provider: "openai",
        modelId: "custom-gpt",
        modelApi: "openai-completions",
        model: {
          provider: "openai",
          api: "openai-completions",
          baseUrl: "https://example.com/v1",
          id: "custom-gpt",
        } as never,
        tools,
      }),
    ).toBe(tools);
  });

  it("normalizes and diagnoses Gemini unsupported schema keywords", () => {
    const hooks = buildProviderToolCompatFamilyHooks("gemini");
    const tools = [
      {
        name: "write",
        description: "",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", additionalProperties: false },
          },
          additionalProperties: false,
        },
      },
    ] as never;

    expect(hooks.inspectToolSchemas({ provider: "google", modelId: "gemini", tools })).toEqual([
      {
        toolName: "write",
        toolIndex: 0,
        violations: [
          "write.parameters.properties.path.additionalProperties",
          "write.parameters.additionalProperties",
        ],
      },
    ]);
    expect(hooks.normalizeToolSchemas({ provider: "google", modelId: "gemini", tools })[0])
      .toMatchObject({
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
        },
      });
  });
});
