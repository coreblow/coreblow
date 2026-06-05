import { assertOkOrThrowHttpError, fetchWithTimeout } from "../media-understanding/shared.js";
import { extensionForMime } from "../media/mime.js";
import type { GeneratedMusicAsset } from "./types.js";

export type GeneratedMusicFileCandidate = {
  url: string;
  mimeType?: string;
  fileName?: string;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSpecificAudioMimeType(value: unknown): string | undefined {
  const mimeType = normalizeOptionalString(value)?.split(";")[0]?.trim().toLowerCase();
  if (!mimeType || mimeType === "application/octet-stream" || mimeType === "binary/octet-stream") {
    return undefined;
  }
  return mimeType;
}

function pushGeneratedMusicFileCandidate(
  candidates: GeneratedMusicFileCandidate[],
  value: unknown,
): void {
  if (typeof value === "string") {
    const url = normalizeOptionalString(value);
    if (url) {
      candidates.push({ url });
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const url = normalizeOptionalString(value.url);
  if (!url) {
    return;
  }
  candidates.push({
    url,
    ...(normalizeOptionalString(value.content_type)
      ? { mimeType: normalizeOptionalString(value.content_type) }
      : {}),
    ...(normalizeOptionalString(value.file_name)
      ? { fileName: normalizeOptionalString(value.file_name) }
      : {}),
  });
}

export function extractGeneratedMusicFileCandidates(
  payload: unknown,
  keys: readonly string[] = ["audio", "audio_file"],
): GeneratedMusicFileCandidate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const candidates: GeneratedMusicFileCandidate[] = [];
  for (const key of keys) {
    pushGeneratedMusicFileCandidate(candidates, payload[key]);
  }
  return candidates;
}

export function generatedMusicAssetFromBase64(params: {
  base64: string;
  mimeType: string;
  index?: number;
  fileName?: string;
}): GeneratedMusicAsset {
  const ext = extensionForMime(params.mimeType)?.replace(/^\./u, "") || "mp3";
  return {
    buffer: Buffer.from(params.base64, "base64"),
    mimeType: params.mimeType,
    fileName: params.fileName ?? `track-${(params.index ?? 0) + 1}.${ext}`,
  };
}

export async function downloadGeneratedMusicAsset(params: {
  candidate: GeneratedMusicFileCandidate;
  timeoutMs: number;
  fetchFn: typeof fetch;
  provider: string;
  requestFailedMessage: string;
  index?: number;
}): Promise<GeneratedMusicAsset> {
  const response = await fetchWithTimeout(
    params.candidate.url,
    { method: "GET" },
    params.timeoutMs,
    params.fetchFn,
  );
  await assertOkOrThrowHttpError(response, params.requestFailedMessage);
  const mimeType =
    normalizeSpecificAudioMimeType(response.headers.get("content-type")) ??
    normalizeSpecificAudioMimeType(params.candidate.mimeType) ??
    "audio/mpeg";
  const ext = extensionForMime(mimeType)?.replace(/^\./u, "") || "mp3";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    fileName: params.candidate.fileName ?? `track-${(params.index ?? 0) + 1}.${ext}`,
    metadata: {
      url: params.candidate.url,
    },
  };
}
