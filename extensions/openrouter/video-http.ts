import { assertOkOrThrowHttpError } from "coreblow/plugin-sdk/provider-http";

export type OpenRouterVideoPollResult = {
  id?: string;
  status?: string;
  pollingUrl?: string;
  videos: string[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectStringUrls(value: unknown, out: string[]): void {
  if (typeof value === "string" && /^https?:\/\//u.test(value)) {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStringUrls(entry, out);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const key of ["url", "video_url", "unsigned_url", "signed_url"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && /^https?:\/\//u.test(candidate)) {
      out.push(candidate);
    }
  }
  for (const key of ["videos", "data", "output", "result", "results", "unsigned_urls"]) {
    collectStringUrls(record[key], out);
  }
}

export function parseOpenRouterVideoPollResult(payload: unknown): OpenRouterVideoPollResult {
  const record = asRecord(payload) ?? {};
  const videos: string[] = [];
  collectStringUrls(record.videos ?? record.output ?? record.data ?? record.result ?? payload, videos);
  return {
    id: typeof record.id === "string" ? record.id : undefined,
    status: typeof record.status === "string" ? record.status.toLowerCase() : undefined,
    pollingUrl:
      typeof record.polling_url === "string"
        ? record.polling_url
        : typeof record.pollingUrl === "string"
          ? record.pollingUrl
          : undefined,
    videos: [...new Set(videos)],
  };
}

export function buildOpenRouterVideoHeaders(apiKey: string): Headers {
  return new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://coreblow.com",
    "X-OpenRouter-Title": "CoreBlow",
  });
}

export async function fetchOpenRouterVideoJson(params: {
  url: string;
  headers: Headers;
  init?: RequestInit;
  fetchFn?: typeof fetch;
  errorLabel: string;
}): Promise<unknown> {
  const fetchFn = params.fetchFn ?? fetch;
  const response = await fetchFn(params.url, {
    ...(params.init ?? {}),
    headers: params.headers,
  });
  await assertOkOrThrowHttpError(response, params.errorLabel);
  return await response.json();
}
