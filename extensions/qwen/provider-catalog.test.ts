import { describe, expect, it } from "vitest";
import {
  applyQwenNativeStreamingUsageCompat,
  buildQwenProvider,
  QWEN_36_PLUS_MODEL_ID,
  QWEN_BASE_URL,
  QWEN_DEFAULT_MODEL_ID,
  QWEN_STANDARD_GLOBAL_BASE_URL,
} from "./api.js";

type QwenProvider = ReturnType<typeof buildQwenProvider>;

function getQwenModelIds(provider: QwenProvider): string[] {
  return provider.models?.map((model) => model.id) ?? [];
}

describe("qwen provider catalog", () => {
  it("builds the bundled Qwen provider defaults", () => {
    const provider = buildQwenProvider();

    expect(provider.baseUrl).toBe(QWEN_BASE_URL);
    expect(provider.api).toBe("openai-completions");
    const modelIds = getQwenModelIds(provider);
    expect(modelIds.length).toBeGreaterThan(0);
    expect(modelIds).toContain(QWEN_DEFAULT_MODEL_ID);
    expect(modelIds).not.toContain(QWEN_36_PLUS_MODEL_ID);
  });

  it("only advertises qwen3.6-plus on Standard endpoints", () => {
    const coding = buildQwenProvider({ baseUrl: QWEN_BASE_URL });
    const codingTrailingDot = buildQwenProvider({
      baseUrl: " https://coding-intl.dashscope.aliyuncs.com./v1 ",
    });
    const standard = buildQwenProvider({ baseUrl: QWEN_STANDARD_GLOBAL_BASE_URL });

    expect(getQwenModelIds(coding)).not.toContain(QWEN_36_PLUS_MODEL_ID);
    expect(getQwenModelIds(codingTrailingDot)).not.toContain(QWEN_36_PLUS_MODEL_ID);
    expect(getQwenModelIds(standard)).toContain(QWEN_36_PLUS_MODEL_ID);
  });

  it("opts native Qwen base URLs into streaming usage only inside the extension", () => {
    const nativeProvider = applyQwenNativeStreamingUsageCompat(buildQwenProvider());
    expect(nativeProvider.models?.length).toBeGreaterThan(0);
    expect(
      nativeProvider.models?.every((model) => model.compat?.supportsUsageInStreaming === true),
    ).toBe(true);

    const customProvider = applyQwenNativeStreamingUsageCompat({
      ...buildQwenProvider(),
      baseUrl: "https://proxy.example.com/v1",
    });
    expect(
      customProvider.models?.some(
        (model) => model.compat?.supportsUsageInStreaming === true,
      ),
    ).toBe(false);
  });
});
