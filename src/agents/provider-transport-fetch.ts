import type { Api, Model } from "@mariozechner/pi-ai";
import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
import { resolveProviderEndpoint } from "./provider-attribution.js";

export function resolveModelRequestTimeoutMs(
  model: Model<Api>,
  timeoutMs: number | undefined,
): number | undefined {
  if (timeoutMs !== undefined) {
    return timeoutMs;
  }
  const modelTimeoutMs = (model as { requestTimeoutMs?: unknown }).requestTimeoutMs;
  return typeof modelTimeoutMs === "number" && Number.isFinite(modelTimeoutMs) && modelTimeoutMs > 0
    ? Math.floor(modelTimeoutMs)
    : undefined;
}

function requestBodyHasStreamTrue(init?: RequestInit): boolean {
  if (typeof init?.body === "string") {
    try {
      return (JSON.parse(init.body) as { stream?: unknown }).stream === true;
    } catch {
      return false;
    }
  }
  return false;
}

function sanitizeOpenAISdkSseResponse(
  response: Response,
  options?: { synthesizeJsonAsSse?: boolean },
): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !response.body) {
    return response;
  }
  if (
    options?.synthesizeJsonAsSse === true &&
    (/\bapplication\/json\b/i.test(contentType) || /\+json\b/i.test(contentType))
  ) {
    const source = response.body;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let buffer = "";
    const sseBody = new ReadableStream<Uint8Array>({
      start() {
        reader = source.getReader();
      },
      async pull(controller) {
        try {
          for (;;) {
            const chunk = await reader?.read();
            if (!chunk || chunk.done) {
              buffer += decoder.decode();
              const data = buffer.trim();
              if (data) {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            buffer += decoder.decode(chunk.value, { stream: true });
          }
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel(reason) {
        await reader?.cancel(reason);
      },
    });
    const headers = new Headers(response.headers);
    headers.set("content-type", "text/event-stream; charset=utf-8");
    return new Response(sseBody, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
}

export function buildGuardedModelFetch(
  model: Model<Api>,
  timeoutMs?: number,
  options?: { sanitizeSse?: boolean },
): typeof fetch {
  const requestTimeoutMs = resolveModelRequestTimeoutMs(model, timeoutMs);
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const endpointResolution = resolveProviderEndpoint(model?.baseUrl);
    const isLocal =
      endpointResolution.endpointClass === "local" ||
      url.includes("127.0.0.1") ||
      url.includes("localhost");
    const policy = isLocal ? { allowPrivateNetwork: true } : undefined;
    const synthesizeJsonAsSse = requestBodyHasStreamTrue(init);

    let response: Response;
    if (isLocal) {
      response = await fetch(input, init);
    } else {
      const result = await fetchWithSsrFGuard({
        url,
        init,
        timeoutMs: requestTimeoutMs,
        ...(policy ? { policy } : {}),
        mode: "strict",
      });
      response = result.response;
    }
    if (options?.sanitizeSse !== false) {
      response = sanitizeOpenAISdkSseResponse(response, { synthesizeJsonAsSse });
    }
    return response;
  };
}
