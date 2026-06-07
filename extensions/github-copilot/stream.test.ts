import { describe, expect, it, vi } from "vitest";
import {
  buildCopilotDynamicHeaders,
  wrapCopilotOpenAICompletionsStream,
  wrapCopilotOpenAIResponsesStream,
  wrapCopilotProviderStream,
} from "./stream.js";

function requireStreamFn(streamFn: ReturnType<typeof wrapCopilotProviderStream>) {
  expect(streamFn).toBeTypeOf("function");
  if (!streamFn) {
    throw new Error("expected stream fn");
  }
  return streamFn;
}

describe("github-copilot stream wrappers", () => {
  it("adds Copilot headers and rewrites Responses replay IDs", async () => {
    const connectionBoundId = Buffer.from(`message-${"y".repeat(24)}`).toString("base64");
    let returnedPayload: unknown;
    const baseStreamFn = vi.fn(async (_model, _context, options) => {
      returnedPayload = await options?.onPayload?.({ input: [] }, _model);
      return { async *[Symbol.asyncIterator]() {} } as never;
    });

    const wrapped = requireStreamFn(wrapCopilotOpenAIResponsesStream(baseStreamFn));
    await wrapped(
      { provider: "github-copilot", api: "openai-responses", id: "gpt-5.4" } as never,
      { messages: [{ role: "user", content: "hi" }] } as never,
      {
        onPayload: () => ({ input: [{ id: connectionBoundId, type: "message" }] }),
      } as never,
    );

    const options = (baseStreamFn.mock.calls[0] as unknown[] | undefined)?.[2] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(options?.headers?.["Openai-Organization"]).toBe("github-copilot");
    expect((returnedPayload as { input: Array<Record<string, unknown>> }).input[0]?.id).toMatch(
      /^msg_[a-f0-9]{16}$/,
    );
  });

  it("adds Copilot headers for Chat Completions models", () => {
    const baseStreamFn = vi.fn(() => ({ async *[Symbol.asyncIterator]() {} }) as never);
    const wrapped = requireStreamFn(wrapCopilotOpenAICompletionsStream(baseStreamFn));
    const messages = [{ role: "user", content: "hi" }] as Parameters<
      typeof buildCopilotDynamicHeaders
    >[0]["messages"];

    void wrapped(
      { provider: "github-copilot", api: "openai-completions", id: "gemini-pro" } as never,
      { messages } as never,
      { headers: { Existing: "1" } },
    );

    const options = (baseStreamFn.mock.calls[0] as unknown[] | undefined)?.[2] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(options?.headers).toMatchObject({
      Existing: "1",
      "Openai-Organization": "github-copilot",
      "x-initiator": "user",
    });
  });
});
