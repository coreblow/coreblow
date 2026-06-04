import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { buildQwenMediaUnderstandingProvider, describeQwenVideo } from "./media-understanding-provider.js";

describe("qwen media understanding provider", () => {
  it("advertises image and video capabilities", () => {
    const provider = buildQwenMediaUnderstandingProvider();

    expect(provider).toMatchObject({
      id: "qwen",
      capabilities: ["image", "video"],
      defaultModels: {
        image: "qwen-vl-max-latest",
        video: "qwen-vl-max-latest",
      },
      autoPriority: {
        video: 15,
      },
    });
    expect(provider.describeVideo).toBeTypeOf("function");
  });

  it("describes video through the OpenAI-compatible chat endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: [{ text: "video summary" }] } }],
        }),
        { status: 200 },
      );
    };

    const result = await describeQwenVideo({
      apiKey: "test-key",
      buffer: Buffer.from("video"),
      fileName: "clip.mp4",
      timeoutMs: 1000,
      fetchFn,
    });

    expect(result).toEqual({ text: "video summary", model: "qwen-vl-max-latest" });
    expect(calls[0]?.url).toBe(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toBeInstanceOf(Headers);
    expect((calls[0]?.init?.headers as Headers).get("authorization")).toBe("Bearer test-key");
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      model: "qwen-vl-max-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe the video in detail." },
            { type: "video_url" },
          ],
        },
      ],
    });
  });
});
