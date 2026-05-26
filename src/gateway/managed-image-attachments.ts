import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { readLocalFileSafely } from "../infra/fs-safe.js";
import { safeFileURLToPath } from "../infra/local-file-access.js";
import { assertLocalMediaAllowed } from "../media/local-media-access.js";
import { getImageMetadata } from "../media/image-ops.js";
import { resolveUserPath } from "../utils.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { sendJson, sendMethodNotAllowed, sendMissingScopeForbidden } from "./http-common.js";
import {
  authorizeGatewayHttpRequestOrReply,
  resolveOpenAiCompatibleHttpOperatorScopes,
  resolveOpenAiCompatibleHttpSenderIsOwner,
} from "./http-auth-utils.js";
import { authorizeOperatorScopesForMethod } from "./method-scopes.js";

const OUTGOING_IMAGE_ROUTE_PREFIX = "/api/chat/media/outgoing";
const DEFAULT_TRANSIENT_OUTGOING_IMAGE_TTL_MS = 15 * 60 * 1000;
const MANAGED_OUTGOING_ATTACHMENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_URL_RE = /^data:/i;
const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;

export const DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS = {
  maxBytes: 12 * 1024 * 1024,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 20_000_000,
} as const;

export type ManagedImageAttachmentLimits = {
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
};

type ManagedImageAttachmentLimitsConfig = Partial<ManagedImageAttachmentLimits>;

type ManagedImageRecordVariant = {
  path: string;
  contentType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  filename: string | null;
};

type ManagedImageRetentionClass = "transient" | "history";

type ManagedImageRecord = {
  attachmentId: string;
  sessionKey: string;
  messageId: string | null;
  createdAt: string;
  updatedAt?: string;
  retentionClass?: ManagedImageRetentionClass;
  alt: string;
  original: ManagedImageRecordVariant;
};

type ManagedImageBlock = Record<string, unknown>;

export function resolveManagedImageAttachmentLimits(
  config?: ManagedImageAttachmentLimitsConfig | null,
): ManagedImageAttachmentLimits {
  return {
    maxBytes: config?.maxBytes ?? DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS.maxBytes,
    maxWidth: config?.maxWidth ?? DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS.maxWidth,
    maxHeight: config?.maxHeight ?? DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS.maxHeight,
    maxPixels: config?.maxPixels ?? DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS.maxPixels,
  };
}

function formatLimitMiB(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${bytes} bytes`;
  }
  return Number.isInteger(bytes / (1024 * 1024))
    ? `${bytes / (1024 * 1024)} MiB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function createManagedImageAttachmentError(message: string): Error {
  const error = new Error(message);
  error.name = "ManagedImageAttachmentError";
  return error;
}

function resolveOutgoingRecordsDir(stateDir = resolveStateDir()): string {
  return path.join(stateDir, "media", "outgoing", "records");
}

function resolveOutgoingOriginalsDir(stateDir = resolveStateDir()): string {
  return path.join(stateDir, "media", "outgoing", "originals");
}

function resolveOutgoingRecordPath(attachmentId: string, stateDir = resolveStateDir()): string {
  return path.join(resolveOutgoingRecordsDir(stateDir), `${attachmentId}.json`);
}

function buildOutgoingVariantUrl(sessionKey: string, attachmentId: string, variant: "full"): string {
  return `${OUTGOING_IMAGE_ROUTE_PREFIX}/${encodeURIComponent(sessionKey)}/${attachmentId}/${variant}`;
}

function parseManagedOutgoingRoute(
  value: string,
): { sessionKey: string; attachmentId: string } | null {
  const match = new RegExp(`^${OUTGOING_IMAGE_ROUTE_PREFIX}/([^/]+)/([^/]+)/full$`).exec(value);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  try {
    return {
      sessionKey: decodeURIComponent(match[1]),
      attachmentId: match[2],
    };
  } catch {
    return null;
  }
}

function buildManagedImageBlock(record: ManagedImageRecord): ManagedImageBlock {
  const fullUrl = buildOutgoingVariantUrl(record.sessionKey, record.attachmentId, "full");
  return {
    type: "image",
    url: fullUrl,
    openUrl: fullUrl,
    alt: record.alt,
    mimeType: record.original.contentType,
    width: record.original.width,
    height: record.original.height,
  };
}

function deriveAltText(source: string, index: number): string {
  const fallback = `Generated image ${index + 1}`;
  if (DATA_URL_RE.test(source)) {
    return fallback;
  }
  try {
    const url = new URL(source);
    return decodeURIComponent(path.basename(url.pathname)) || fallback;
  } catch {
    return path.basename(source) || fallback;
  }
}

function resolveLocalMediaPath(source: string): string | undefined {
  if (!source.trim()) {
    return undefined;
  }
  if (source.startsWith("file:")) {
    return safeFileURLToPath(source);
  }
  if (
    source.startsWith("/") ||
    source.startsWith("~") ||
    source.startsWith(".") ||
    WINDOWS_DRIVE_RE.test(source)
  ) {
    return resolveUserPath(source);
  }
  return undefined;
}

function parseImageDataUrl(
  source: string,
  alt: string,
  limits: ManagedImageAttachmentLimits,
): { buffer: Buffer; contentType: string } | "non-image" | null {
  if (!DATA_URL_RE.test(source)) {
    return null;
  }
  const match = /^data:([^;,]+)(;base64)?,(.*)$/is.exec(source);
  if (!match) {
    throw createManagedImageAttachmentError(`Invalid image data URL for ${JSON.stringify(alt)}`);
  }
  const contentType = (match[1] ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    return "non-image";
  }
  const body = match[3] ?? "";
  const buffer = match[2]
    ? Buffer.from(body.replace(/\s+/g, ""), "base64")
    : Buffer.from(decodeURIComponent(body));
  validateManagedImageBuffer(buffer, alt, limits);
  return { buffer, contentType };
}

function extensionForContentType(contentType: string): string {
  switch (contentType.split(";")[0]?.trim().toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function validateManagedImageBuffer(
  buffer: Buffer,
  alt: string,
  limits: ManagedImageAttachmentLimits,
): void {
  if (buffer.byteLength > limits.maxBytes) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(alt)} exceeds the ${formatLimitMiB(limits.maxBytes)} byte limit`,
    );
  }
}

function validateManagedImageMetadata(
  metadata: { width: number; height: number } | null,
  alt: string,
  limits: ManagedImageAttachmentLimits,
): void {
  if (!metadata) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(alt)} is missing readable dimensions`,
    );
  }
  if (metadata.width > limits.maxWidth) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(alt)} exceeds the ${limits.maxWidth}px width limit`,
    );
  }
  if (metadata.height > limits.maxHeight) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(alt)} exceeds the ${limits.maxHeight}px height limit`,
    );
  }
  if (metadata.width * metadata.height > limits.maxPixels) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(alt)} exceeds the ${limits.maxPixels.toLocaleString("en-US")} pixel limit`,
    );
  }
}

function toRecordFilename(filePath: string): string | null {
  const name = path.basename(filePath).trim();
  return name || null;
}

async function writeManagedImageRecord(
  record: ManagedImageRecord,
  stateDir = resolveStateDir(),
): Promise<void> {
  const recordPath = resolveOutgoingRecordPath(record.attachmentId, stateDir);
  await fs.mkdir(path.dirname(recordPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
}

async function readManagedImageRecord(
  attachmentId: string,
  stateDir = resolveStateDir(),
): Promise<ManagedImageRecord | null> {
  try {
    const raw = await fs.readFile(resolveOutgoingRecordPath(attachmentId, stateDir), "utf-8");
    return JSON.parse(raw) as ManagedImageRecord;
  } catch {
    return null;
  }
}

async function saveOriginalImage(params: {
  buffer: Buffer;
  contentType: string;
  stateDir: string;
  filename: string;
}): Promise<string> {
  const extension = extensionForContentType(params.contentType);
  const safeName = params.filename.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80) || "image";
  const filePath = path.join(
    resolveOutgoingOriginalsDir(params.stateDir),
    `${randomUUID()}-${safeName}${extension}`,
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, params.buffer, { mode: 0o600 });
  return filePath;
}

async function readManagedImageSource(params: {
  source: string;
  alt: string;
  index: number;
  limits: ManagedImageAttachmentLimits;
  localRoots?: readonly string[] | "any";
}): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const parsedDataUrl = parseImageDataUrl(params.source, params.alt, params.limits);
  if (parsedDataUrl === "non-image") {
    return null;
  }
  if (parsedDataUrl) {
    return {
      ...parsedDataUrl,
      filename: `generated-image-${params.index + 1}`,
    };
  }

  const localMediaPath = resolveLocalMediaPath(params.source);
  if (!localMediaPath) {
    throw createManagedImageAttachmentError(
      `Managed image attachment ${JSON.stringify(params.alt)} must be a local path or image data URL`,
    );
  }
  await assertLocalMediaAllowed(localMediaPath, params.localRoots);
  const { buffer, stat } = await readLocalFileSafely({
    filePath: localMediaPath,
    maxBytes: params.limits.maxBytes,
  });
  validateManagedImageBuffer(buffer, params.alt, params.limits);
  const extension = path.extname(localMediaPath).toLowerCase();
  const contentType =
    extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : extension === ".gif"
            ? "image/gif"
            : "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return null;
  }
  if (stat.size > params.limits.maxBytes) {
    validateManagedImageBuffer(buffer, params.alt, params.limits);
  }
  return {
    buffer,
    contentType,
    filename: path.basename(localMediaPath) || `generated-image-${params.index + 1}`,
  };
}

export async function createManagedOutgoingImageBlocks(params: {
  sessionKey: string;
  mediaUrls?: string[] | null;
  stateDir?: string;
  messageId?: string | null;
  limits?: ManagedImageAttachmentLimitsConfig | null;
  localRoots?: readonly string[] | "any";
  continueOnPrepareError?: boolean;
  onPrepareError?: (error: Error) => void;
}): Promise<ManagedImageBlock[]> {
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey || !Array.isArray(params.mediaUrls) || params.mediaUrls.length === 0) {
    return [];
  }
  const stateDir = params.stateDir ?? resolveStateDir();
  const limits = resolveManagedImageAttachmentLimits(params.limits);
  const blocks: ManagedImageBlock[] = [];

  for (const [index, mediaUrl] of params.mediaUrls.entries()) {
    const alt = deriveAltText(mediaUrl, index);
    try {
      const source = await readManagedImageSource({
        source: mediaUrl,
        alt,
        index,
        limits,
        localRoots: params.localRoots,
      });
      if (!source) {
        continue;
      }
      const metadata = await getImageMetadata(source.buffer);
      validateManagedImageMetadata(metadata, alt, limits);
      const originalPath = await saveOriginalImage({
        buffer: source.buffer,
        contentType: source.contentType,
        stateDir,
        filename: source.filename,
      });
      const record: ManagedImageRecord = {
        attachmentId: randomUUID(),
        sessionKey,
        messageId: params.messageId ?? null,
        createdAt: new Date().toISOString(),
        retentionClass: params.messageId ? "history" : "transient",
        alt,
        original: {
          path: originalPath,
          contentType: source.contentType,
          width: metadata?.width ?? null,
          height: metadata?.height ?? null,
          sizeBytes: source.buffer.byteLength,
          filename: toRecordFilename(originalPath),
        },
      };
      await writeManagedImageRecord(record, stateDir);
      blocks.push(buildManagedImageBlock(record));
    } catch (error) {
      const managedError =
        error instanceof Error
          ? error
          : createManagedImageAttachmentError(
              `Managed image attachment ${JSON.stringify(alt)} could not be prepared`,
            );
      if (params.continueOnPrepareError) {
        params.onPrepareError?.(managedError);
        continue;
      }
      throw managedError;
    }
  }

  return blocks;
}

function collectManagedOutgoingAttachmentRefs(
  blocks?: readonly Record<string, unknown>[],
): Array<{ attachmentId: string; sessionKey: string }> {
  if (!blocks) {
    return [];
  }
  const refs = new Map<string, { attachmentId: string; sessionKey: string }>();
  for (const block of blocks) {
    for (const candidate of [block.url, block.openUrl]) {
      if (typeof candidate !== "string") {
        continue;
      }
      const parsed = parseManagedOutgoingRoute(candidate);
      if (!parsed) {
        continue;
      }
      refs.set(`${parsed.sessionKey}:${parsed.attachmentId}`, parsed);
    }
  }
  return [...refs.values()];
}

export async function attachManagedOutgoingImagesToMessage(params: {
  messageId: string;
  blocks?: readonly Record<string, unknown>[];
  stateDir?: string;
}): Promise<void> {
  const messageId = params.messageId.trim();
  if (!messageId) {
    return;
  }
  const refs = collectManagedOutgoingAttachmentRefs(params.blocks);
  await Promise.all(
    refs.map(async ({ attachmentId, sessionKey }) => {
      const record = await readManagedImageRecord(attachmentId, params.stateDir);
      if (!record || record.sessionKey !== sessionKey) {
        return;
      }
      await writeManagedImageRecord(
        {
          ...record,
          messageId,
          retentionClass: "history",
          updatedAt: new Date().toISOString(),
        },
        params.stateDir,
      );
    }),
  );
}

export async function cleanupManagedOutgoingImageRecords(params?: {
  stateDir?: string;
  sessionKey?: string;
  nowMs?: number;
  transientTtlMs?: number;
}): Promise<{ deletedRecordCount: number; deletedFileCount: number; retainedCount: number }> {
  const stateDir = params?.stateDir ?? resolveStateDir();
  const nowMs = params?.nowMs ?? Date.now();
  const transientTtlMs = params?.transientTtlMs ?? DEFAULT_TRANSIENT_OUTGOING_IMAGE_TTL_MS;
  let deletedRecordCount = 0;
  let deletedFileCount = 0;
  let retainedCount = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(resolveOutgoingRecordsDir(stateDir));
  } catch {
    return { deletedRecordCount, deletedFileCount, retainedCount };
  }

  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const recordPath = path.join(resolveOutgoingRecordsDir(stateDir), entry);
    const attachmentId = path.basename(entry, ".json");
    const record = await readManagedImageRecord(attachmentId, stateDir);
    if (!record) {
      continue;
    }
    if (params?.sessionKey && record.sessionKey !== params.sessionKey) {
      retainedCount += 1;
      continue;
    }
    const createdAtMs = Date.parse(record.createdAt);
    const expired =
      (record.retentionClass ?? "transient") === "transient" &&
      Number.isFinite(createdAtMs) &&
      nowMs - createdAtMs > transientTtlMs;
    if (!expired) {
      retainedCount += 1;
      continue;
    }
    await fs.rm(record.original.path, { force: true }).then(
      () => {
        deletedFileCount += 1;
      },
      () => undefined,
    );
    await fs.rm(recordPath, { force: true });
    deletedRecordCount += 1;
  }

  return { deletedRecordCount, deletedFileCount, retainedCount };
}

function sendStatus(res: ServerResponse, statusCode: number, body: string): void {
  if (res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
}

function safeAttachmentFilename(value: string | null): string {
  const fallback = "generated-image";
  const base = (value ?? fallback).replace(/[\r\n"\\]/g, "_").trim();
  return base || fallback;
}

export async function handleManagedOutgoingImageHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
    stateDir?: string;
  },
): Promise<boolean> {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const route = parseManagedOutgoingRoute(requestUrl.pathname);
  if (!route) {
    return false;
  }

  if (req.method !== "GET") {
    sendMethodNotAllowed(res, "GET");
    return true;
  }

  const requestAuth = await authorizeGatewayHttpRequestOrReply({
    req,
    res,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
  });
  if (!requestAuth) {
    return true;
  }

  const requestedScopes = resolveOpenAiCompatibleHttpOperatorScopes(req, requestAuth);
  const scopeAuth = authorizeOperatorScopesForMethod("chat.history", requestedScopes);
  if (!scopeAuth.allowed) {
    sendMissingScopeForbidden(res, scopeAuth.missingScope);
    return true;
  }

  if (!MANAGED_OUTGOING_ATTACHMENT_ID_RE.test(route.attachmentId)) {
    sendStatus(res, 404, "not found");
    return true;
  }

  const record = await readManagedImageRecord(route.attachmentId, opts.stateDir);
  if (!record || record.sessionKey !== route.sessionKey) {
    sendStatus(res, 404, "not found");
    return true;
  }
  if (!resolveOpenAiCompatibleHttpSenderIsOwner(req, requestAuth)) {
    sendJson(res, 403, {
      ok: false,
      error: {
        type: "forbidden",
        message: "owner access required",
      },
    });
    return true;
  }
  if (!record.messageId) {
    sendStatus(res, 404, "not found");
    return true;
  }

  let body: Buffer;
  try {
    body = (await readLocalFileSafely({ filePath: record.original.path })).buffer;
  } catch {
    sendStatus(res, 404, "not found");
    return true;
  }

  res.statusCode = 200;
  res.setHeader("content-type", record.original.contentType || "application/octet-stream");
  res.setHeader("content-length", String(body.byteLength));
  res.setHeader("cache-control", "private, max-age=31536000, immutable");
  res.setHeader(
    "content-disposition",
    `inline; filename="${safeAttachmentFilename(record.original.filename)}"`,
  );
  res.end(body);
  return true;
}
