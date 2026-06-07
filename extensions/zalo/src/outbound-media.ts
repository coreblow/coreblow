import type { IncomingMessage, ServerResponse } from "node:http";

export function resolveHostedZaloMediaRoutePrefix(params: {
  webhookUrl: string;
  webhookPath?: string;
}): string {
  const path = params.webhookPath?.trim();
  if (path) {
    return path.endsWith("/media") ? path : `${path.replace(/\/+$/, "")}/media`;
  }
  const parsed = new URL(params.webhookUrl);
  const base = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/zalo";
  return `${base.replace(/\/+$/, "")}/media`;
}

export async function prepareHostedZaloMediaUrl(params: {
  mediaUrl: string;
  webhookUrl: string;
  webhookPath?: string;
  maxBytes: number;
  proxyUrl?: string;
}): Promise<string> {
  void params.maxBytes;
  void params.proxyUrl;
  return params.mediaUrl;
}

export async function tryHandleHostedZaloMediaRequest(
  _req: IncomingMessage,
  _res: ServerResponse,
): Promise<boolean> {
  return false;
}

export function clearHostedZaloMediaForTest(): void {}
