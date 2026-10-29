import type { MessageMetadata } from "@slack/types";
import { type Block, type KnownBlock, type WebClient } from "@slack/web-api";
import {
  createMessageReceiptFromOutboundResults,
  type MessageReceipt,
  type MessageReceiptPartKind,
  type MessageReceiptSourceResult,
} from "coreblow/plugin-sdk/channel-message";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import { withTrustedEnvProxyGuardedFetchMode } from "coreblow/plugin-sdk/fetch-runtime";
import { resolveMarkdownTableMode } from "coreblow/plugin-sdk/markdown-table-runtime";
import { requireRuntimeConfig } from "coreblow/plugin-sdk/plugin-config-runtime";
import {
  chunkMarkdownTextWithMode,
  isSilentReplyText,
  resolveChunkMode,
  resolveTextChunkLimit,
} from "coreblow/plugin-sdk/reply-chunking";
import { resolveTextChunksWithFallback } from "coreblow/plugin-sdk/reply-payload";
import { logVerbose } from "coreblow/plugin-sdk/runtime-env";
import { fetchWithSsrFGuard } from "coreblow/plugin-sdk/ssrf-runtime";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "coreblow/plugin-sdk/string-coerce-runtime";
import type { SlackTokenSource } from "./accounts.js";
import { resolveSlackAccount } from "./accounts.js";
import { buildSlackBlocksFallbackText } from "./blocks-fallback.js";
import { validateSlackBlocksArray } from "./blocks-input.js";
import { createSlackTokenCacheKey, getSlackWriteClient } from "./client.js";
import { markdownToSlackMrkdwnChunks } from "./format.js";
import { SLACK_TEXT_LIMIT } from "./limits.js";
import { loadOutboundMediaFromUrl } from "./runtime-api.js";
import { recordSlackThreadParticipation } from "./sent-thread-cache.js";
import { parseSlackTarget } from "./targets.js";
import { normalizeSlackThreadTsCandidate } from "./thread-ts.js";
import { resolveSlackBotToken } from "./token.js";
import { truncateSlackText } from "./truncate.js";

const SLACK_UPLOAD_SSRF_POLICY = {
  allowedHostnames: ["*.slack.com", "*.slack-edge.com", "*.slack-files.com"],
  allowRfc2544BenchmarkRange: true,
};
const SLACK_DM_CHANNEL_CACHE_MAX = 1024;
const SLACK_DNS_RETRY_CODES = new Set(["EAI_AGAIN", "ENOTFOUND", "UND_ERR_DNS_RESOLVE_FAILED"]);
const SLACK_DNS_RETRY_ATTEMPTS = 2;
const SLACK_DNS_RETRY_BASE_DELAY_MS = 250;
const slackDmChannelCache = new Map<string, string>();
const slackSendQueues = new Map<string, Promise<void>>();

type SlackRecipient =
  | {
      kind: "user";
      id: string;
    }
  | {
      kind: "channel";
      id: string;
    };

export type SlackSendIdentity = {
  username?: string;
  iconUrl?: string;
  iconEmoji?: string;
};

type SlackUnfurlOptions = {
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
};

type SlackPostThreadPayload =
  | {
      thread_ts: string;
      reply_broadcast: true;
    }
  | {
      thread_ts: string;
      reply_broadcast?: never;
    }
  | {
      thread_ts?: never;
      reply_broadcast?: never;
    };

type SlackBasePostMessagePayload = SlackPostThreadPayload & {
  channel: string;
  text: string;
  blocks?: (Block | KnownBlock)[];
  metadata?: MessageMetadata;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
};

type SlackSendOpts = {
  cfg?: CoreBlowConfig;
  token?: string;
  accountId?: string;
  mediaUrl?: string;
  mediaAccess?: {
    localRoots?: readonly string[];
    readFile?: (filePath: string) => Promise<Buffer>;
  };
  uploadFileName?: string;
  uploadTitle?: string;
  mediaLocalRoots?: readonly string[];
  mediaReadFile?: (filePath: string) => Promise<Buffer>;
  client?: WebClient;
  threadTs?: string;
  replyBroadcast?: boolean;
  identity?: SlackSendIdentity;
  blocks?: (Block | KnownBlock)[];
  metadata?: MessageMetadata;
};

type SlackWebApiErrorData = {
  error?: unknown;
  needed?: unknown;
  response_metadata?: {
    scopes?: unknown;
    acceptedScopes?: unknown;
  };
};

type SlackWebApiError = Error & {
  data?: SlackWebApiErrorData;
};

function hasCustomIdentity(identity?: SlackSendIdentity): boolean {
  return Boolean(identity?.username || identity?.iconUrl || identity?.iconEmoji);
}

function buildSlackUnfurlPayload(options?: SlackUnfurlOptions) {
  return {
    // Default unfurl_links to false so bot messages don't expand inline
    // link previews (Slack message links, URLs, etc.) unless the operator
    // explicitly opts in via `channels.slack.unfurlLinks: true`.
    unfurl_links: options?.unfurlLinks ?? false,
    ...(typeof options?.unfurlMedia === "boolean" ? { unfurl_media: options.unfurlMedia } : {}),
  };
}

function buildSlackPostMessagePayload(params: {
  channelId: string;
  text: string;
  threadTs?: string;
  replyBroadcast?: boolean;
  blocks?: (Block | KnownBlock)[];
  metadata?: MessageMetadata;
  unfurl?: SlackUnfurlOptions;
}) {
  const basePayload = {
    channel: params.channelId,
    text: params.text,
    ...(params.threadTs
      ? {
          thread_ts: params.threadTs,
          ...(params.replyBroadcast ? { reply_broadcast: true } : {}),
        }
      : {}),
    ...(params.blocks?.length ? { blocks: params.blocks } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...buildSlackUnfurlPayload(params.unfurl),
  } as SlackBasePostMessagePayload;
  return basePayload;
}

function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function formatMissingScopeDetails(data: SlackWebApiErrorData): string {
  const needed = typeof data.needed === "string" ? data.needed.trim() : "";
  const granted = extractStringArray(data.response_metadata?.scopes);
  const accepted = extractStringArray(data.response_metadata?.acceptedScopes);
  const parts: string[] = [];
  if (needed) {
    parts.push(`needed: ${needed}`);
  }
  if (granted.length > 0) {
    parts.push(`granted: ${granted.join(", ")}`);
  }
  if (accepted.length > 0) {
    parts.push(`accepted: ${accepted.join(", ")}`);
  }
  return parts.length > 0 ? ` (${parts.join("; ")})` : "";
}

function normalizeSlackWebApiError(err: unknown): unknown {
  if (!(err instanceof Error)) {
    return err;
  }
  const apiError = err as SlackWebApiError;
  const data = apiError.data;
  if (!data || data.error !== "missing_scope") {
    return err;
  }
  const details = formatMissingScopeDetails(data);
  if (!details || apiError.message.includes(details)) {
    return err;
  }
  apiError.message = `${apiError.message}${details}`;
  return apiError;
}

function canRetryWithoutIdentity(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  const apiError = err as SlackWebApiError;
  const data = apiError.data;
  if (!data || data.error !== "missing_scope") {
    return false;
  }
  if (typeof data.needed === "string" && data.needed.split(",").includes("chat:write.customize")) {
    return true;
  }
  const acceptedScopes = extractStringArray(data.response_metadata?.acceptedScopes);
  if (acceptedScopes.includes("chat:write.customize")) {
    return true;
  }
  const scopes = extractStringArray(data.response_metadata?.scopes);
  return scopes.includes("chat:write.customize");
}

async function postSlackMessageBestEffort(params: {
  client: WebClient;
  channelId: string;
  text: string;
  threadTs?: string;
  replyBroadcast?: boolean;
  identity?: SlackSendIdentity;
  blocks?: (Block | KnownBlock)[];
  metadata?: MessageMetadata;
  unfurl?: SlackUnfurlOptions;
}) {
  const { client, identity } = params;
  const basePayload = buildSlackPostMessagePayload(params);
  const applyIdentity = (
    payload: SlackBasePostMessagePayload,
    targetIdentity: SlackSendIdentity | undefined,
  ) => ({
    ...payload,
    ...(targetIdentity?.username ? { username: targetIdentity.username } : {}),
    ...(targetIdentity?.iconUrl
      ? { icon_url: targetIdentity.iconUrl }
      : targetIdentity?.iconEmoji
        ? { icon_emoji: targetIdentity.iconEmoji }
        : {}),
  });

  try {
    return await client.chat.postMessage(applyIdentity(basePayload, identity));
  } catch (err) {
    if (hasCustomIdentity(identity) && canRetryWithoutIdentity(err)) {
      logVerbose("slack send: missing chat:write.customize, retrying without custom identity");
      try {
        return await client.chat.postMessage(applyIdentity(basePayload, undefined));
      } catch (retryErr) {
        throw normalizeSlackWebApiError(retryErr);
      }
    }
    throw normalizeSlackWebApiError(err);
  }
}

function isDnsRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  if (code && SLACK_DNS_RETRY_CODES.has(code)) {
    return true;
  }
  const cause = "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  return isDnsRetryableError(cause);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDnsRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (err) {
      if (!isDnsRetryableError(err) || attempt >= SLACK_DNS_RETRY_ATTEMPTS) {
        throw err;
      }
      attempt += 1;
      await delay(SLACK_DNS_RETRY_BASE_DELAY_MS * attempt);
    }
  }
}

function parseRecipient(target: string): SlackRecipient {
  const parsed = parseSlackTarget(target, { defaultKind: "channel" });
  if (parsed?.kind === "user") {
    return { kind: "user", id: parsed.id };
  }
  if (parsed?.kind === "channel") {
    return { kind: "channel", id: parsed.id };
  }
  const trimmed = target.trim();
  if (trimmed.startsWith("#")) {
    return { kind: "channel", id: trimmed.slice(1).trim() };
  }
  return { kind: "channel", id: trimmed };
}

function createDmChannelCacheKey(params: {
  accountId: string;
  token: string;
  userId: string;
}): string {
  return `${params.accountId}:${createSlackTokenCacheKey(params.token)}:${params.userId}`;
}

function readCachedDmChannelId(params: {
  accountId: string;
  token: string;
  userId: string;
}): string | undefined {
  const key = createDmChannelCacheKey(params);
  const cached = slackDmChannelCache.get(key);
  if (!cached) {
    return undefined;
  }
  slackDmChannelCache.delete(key);
  slackDmChannelCache.set(key, cached);
  return cached;
}

function setCachedDmChannelId(params: {
  accountId: string;
  token: string;
  userId: string;
  channelId: string;
}): void {
  const key = createDmChannelCacheKey(params);
  if (slackDmChannelCache.has(key)) {
    slackDmChannelCache.delete(key);
  } else if (slackDmChannelCache.size >= SLACK_DM_CHANNEL_CACHE_MAX) {
    const oldestKey = slackDmChannelCache.keys().next().value;
    if (oldestKey) {
      slackDmChannelCache.delete(oldestKey);
    }
  }
  slackDmChannelCache.set(key, params.channelId);
}

function isSlackUserRecipient(recipient: SlackRecipient): boolean {
  return recipient.kind === "user" || /^U[A-Z0-9]+$/i.test(recipient.id);
}

function resolveDirectUserPostChannelId(params: {
  recipient: SlackRecipient;
  hasMedia: boolean;
  threadTs?: string;
}): string | undefined {
  if (!isSlackUserRecipient(params.recipient) || params.hasMedia || params.threadTs) {
    return undefined;
  }
  return params.recipient.id;
}

async function resolveChannelId(
  client: WebClient,
  recipient: SlackRecipient,
  context: { accountId: string; token: string },
): Promise<{ channelId: string; cached: boolean }> {
  if (recipient.kind === "channel") {
    return { channelId: recipient.id, cached: false };
  }
  const cachedChannelId = readCachedDmChannelId({
    accountId: context.accountId,
    token: context.token,
    userId: recipient.id,
  });
  if (cachedChannelId) {
    return { channelId: cachedChannelId, cached: true };
  }
  try {
    const res = await client.conversations.open({ users: recipient.id });
    const channelId = res.channel?.id;
    if (!channelId) {
      throw new Error(`Failed to open DM channel for user: ${recipient.id}`);
    }
    setCachedDmChannelId({
      accountId: context.accountId,
      token: context.token,
      userId: recipient.id,
      channelId,
    });
    return { channelId, cached: false };
  } catch (err) {
    throw normalizeSlackWebApiError(err);
  }
}

function buildUploadUrl(uploadUrl: string): URL {
  const parsed = new URL(uploadUrl);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error(`Invalid upload URL protocol: ${parsed.protocol}`);
  }
  return parsed;
}

async function uploadSlackFile(params: {
  client: WebClient;
  channelId: string;
  mediaUrl: string;
  mediaAccess?: {
    localRoots?: readonly string[];
    readFile?: (filePath: string) => Promise<Buffer>;
  };
  uploadFileName?: string;
  uploadTitle?: string;
  mediaLocalRoots?: readonly string[];
  mediaReadFile?: (filePath: string) => Promise<Buffer>;
  caption?: string;
  threadTs?: string;
  maxBytes?: number;
}): Promise<string> {
  const { buffer, contentType, fileName } = await loadOutboundMediaFromUrl(params.mediaUrl, {
    maxBytes: params.maxBytes,
    localRoots: params.mediaAccess?.localRoots ?? params.mediaLocalRoots,
    readFile: params.mediaAccess?.readFile ?? params.mediaReadFile,
  });
  const length = buffer.byteLength;
  const filename = params.uploadFileName || fileName || "file";
  const title = params.uploadTitle || filename;

  const urlRes = await params.client.filesExternal.getUploadURLExternal({
    filename,
    length,
  });
  const uploadUrl = urlRes.upload_url;
  const fileId = urlRes.file_id;
  if (!uploadUrl || !fileId) {
    throw new Error("Slack did not return an upload URL or file ID");
  }

  const parsedUrl = buildUploadUrl(uploadUrl);
  const uploadResponse = await withDnsRetry(async () =>
    withTrustedEnvProxyGuardedFetchMode(parsedUrl, async () =>
      fetchWithSsrFGuard(
        {
          url: parsedUrl.toString(),
          init: {
            method: "POST",
            headers: {
              ...(contentType ? { "content-type": contentType } : {}),
            },
            body: buffer,
          },
        },
        SLACK_UPLOAD_SSRF_POLICY,
      ),
    ),
  );
  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload file to Slack storage: ${uploadResponse.status} ${uploadResponse.statusText}`,
    );
  }

  const completeRes = await params.client.filesExternal.completeUploadExternal({
    files: [{ id: fileId, title }],
    channel_id: params.channelId,
    ...(params.caption ? { initial_comment: params.caption } : {}),
    ...(params.threadTs ? { thread_ts: params.threadTs } : {}),
  });

  const files = completeRes.files;
  const firstFile = Array.isArray(files) ? files[0] : undefined;
  const messageId =
    (firstFile && typeof firstFile === "object" && "id" in firstFile ? firstFile.id : undefined) ??
    fileId;
  return String(messageId);
}

function resolveSlackSendQueueKey(params: {
  account: ReturnType<typeof resolveSlackAccount>;
  token: string;
  recipient: SlackRecipient;
  threadTs?: string;
}): string {
  const threadKey = params.threadTs?.trim() ? `thread:${params.threadTs.trim()}` : "root";
  return `${params.account.accountId}:${createSlackTokenCacheKey(params.token)}:${params.recipient.kind}:${params.recipient.id}:${threadKey}`;
}

async function enqueueSlackSend<T>(queueKey: string, task: () => Promise<T>): Promise<T> {
  const previous = slackSendQueues.get(queueKey) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queued = previous.catch(() => {}).then(() => current);
  slackSendQueues.set(queueKey, queued);

  try {
    await previous.catch(() => {});
    return await task();
  } finally {
    releaseCurrent();
    if (slackSendQueues.get(queueKey) === queued) {
      slackSendQueues.delete(queueKey);
    }
  }
}

export type SlackSendResult = {
  messageId: string;
  channelId: string;
  receipt: MessageReceipt;
};

function createSlackSendReceipt(params: {
  platformMessageIds: readonly string[];
  channelId?: string;
  kind: MessageReceiptPartKind;
  threadTs?: string;
}): MessageReceipt {
  const platformMessageIds = params.platformMessageIds
    .map((messageId) => messageId.trim())
    .filter((messageId) => messageId && messageId !== "unknown" && messageId !== "suppressed");
  return createMessageReceiptFromOutboundResults({
    results: platformMessageIds.map((messageId) => {
      const result: MessageReceiptSourceResult = {
        channel: "slack",
        messageId,
      };
      if (params.channelId) {
        result.channelId = params.channelId;
      }
      return result;
    }),
    kind: params.kind,
    threadId: params.threadTs,
  });
}

export async function sendMessageSlack(
  target: string,
  message: string,
  opts: SlackSendOpts = { cfg: {} as CoreBlowConfig },
): Promise<SlackSendResult> {
  const cfg = opts.cfg ?? requireRuntimeConfig();
  const account = resolveSlackAccount({ cfg, accountId: opts.accountId });
  const token = resolveSlackBotToken(opts.token ?? account.botToken ?? account.userToken);
  if (!token) {
    throw new Error(
      `Slack bot token is missing for account "${account.accountId}". Configure channels.slack.botToken, channels.slack.accounts.${account.accountId}.botToken, or SLACK_BOT_TOKEN.`,
    );
  }
  const recipient = parseRecipient(target);
  const blocks = opts.blocks ? validateSlackBlocksArray(opts.blocks) : undefined;
  const trimmedMessage = message.trim();
  if (isSilentReplyText(trimmedMessage) && !opts.mediaUrl && !blocks) {
    return { messageId: "silent", channelId: recipient.id };
  }
  if (!trimmedMessage && !opts.mediaUrl && !blocks) {
    throw new Error("Message is empty, but neither mediaUrl nor blocks was provided");
  }

  const queueKey = resolveSlackSendQueueKey({
    account,
    token,
    recipient,
    threadTs: opts.threadTs,
  });

  const result = await enqueueSlackSend(queueKey, async () => {
    return await sendMessageSlackQueuedInner({
      trimmedMessage,
      opts,
      cfg,
      account,
      token,
      recipient,
      blocks,
    });
  });

  if (result.messageId && result.messageId !== "unknown" && result.messageId !== "silent") {
    recordSlackThreadParticipation({
      channelId: result.channelId,
      threadTs: opts.threadTs ?? result.messageId,
      accountId: account.accountId,
    });
  }

  return result;
}

async function sendMessageSlackQueuedInner(params: {
  trimmedMessage: string;
  opts: SlackSendOpts;
  cfg: CoreBlowConfig;
  account: ReturnType<typeof resolveSlackAccount>;
  token: string;
  recipient: SlackRecipient;
  blocks?: (Block | KnownBlock)[];
}): Promise<SlackSendResult> {
  const { opts, cfg, account, token, recipient, blocks, trimmedMessage } = params;
  const client = opts.client ?? getSlackWriteClient(token);
  if (opts.replyBroadcast && opts.mediaUrl) {
    throw new Error("Slack replyBroadcast is only supported for text or block thread replies.");
  }
  const unfurl = {
    unfurlLinks: account.config.unfurlLinks,
    unfurlMedia: account.config.unfurlMedia,
  };
  const directUserPostChannelId = resolveDirectUserPostChannelId({
    recipient,
    hasMedia: Boolean(opts.mediaUrl),
    ...(opts.threadTs ? { threadTs: opts.threadTs } : {}),
  });
  const { channelId } = directUserPostChannelId
    ? { channelId: directUserPostChannelId }
    : await resolveChannelId(client, recipient, {
        accountId: account.accountId,
        token,
      });
  if (blocks) {
    if (opts.mediaUrl) {
      throw new Error("Slack send does not support blocks with mediaUrl");
    }
    const fallbackText = truncateSlackText(
      trimmedMessage || buildSlackBlocksFallbackText(blocks),
      SLACK_TEXT_LIMIT,
    );
    const response = await postSlackMessageBestEffort({
      client,
      channelId,
      text: fallbackText,
      threadTs: opts.threadTs,
      replyBroadcast: opts.replyBroadcast,
      identity: opts.identity,
      blocks,
      metadata: opts.metadata,
      unfurl,
    });
    const messageId = response.ts ?? "unknown";
    return {
      messageId,
      channelId,
      receipt: createSlackSendReceipt({
        platformMessageIds: [messageId],
        channelId,
        kind: "card",
        threadTs: opts.threadTs,
      }),
    };
  }
  const textLimit = resolveTextChunkLimit(cfg, "slack", account.accountId, {
    fallbackLimit: SLACK_TEXT_LIMIT,
  });
  const chunkLimit = Math.min(textLimit, SLACK_TEXT_LIMIT);
  const tableMode = resolveMarkdownTableMode({
    cfg,
    channel: "slack",
    accountId: account.accountId,
  });
  const chunkMode = resolveChunkMode(cfg, "slack", account.accountId);
  const markdownChunks =
    chunkMode === "newline"
      ? chunkMarkdownTextWithMode(trimmedMessage, chunkLimit, chunkMode)
      : [trimmedMessage];
  const chunks = markdownChunks.flatMap((markdown) =>
    markdownToSlackMrkdwnChunks(markdown, chunkLimit, { tableMode }),
  );
  const resolvedChunks = resolveTextChunksWithFallback(trimmedMessage, chunks);
  const mediaMaxBytes =
    typeof account.config.mediaMaxMb === "number"
      ? account.config.mediaMaxMb * 1024 * 1024
      : undefined;

  const sentMessageIds: string[] = [];
  let lastMessageId = "";
  if (opts.mediaUrl) {
    const [firstChunk, ...rest] = resolvedChunks;
    lastMessageId = await uploadSlackFile({
      client,
      channelId,
      mediaUrl: opts.mediaUrl,
      mediaAccess: opts.mediaAccess,
      uploadFileName: opts.uploadFileName,
      uploadTitle: opts.uploadTitle,
      mediaLocalRoots: opts.mediaLocalRoots,
      mediaReadFile: opts.mediaReadFile,
      caption: firstChunk,
      threadTs: opts.threadTs,
      maxBytes: mediaMaxBytes,
    });
    sentMessageIds.push(lastMessageId);
    for (const chunk of rest) {
      const response = await postSlackMessageBestEffort({
        client,
        channelId,
        text: chunk,
        threadTs: opts.threadTs,
        replyBroadcast: sentMessageIds.length === 0 ? opts.replyBroadcast : undefined,
        identity: opts.identity,
        metadata: sentMessageIds.length === 0 ? opts.metadata : undefined,
        unfurl,
      });
      lastMessageId = response.ts ?? lastMessageId;
      if (response.ts) {
        sentMessageIds.push(response.ts);
      }
    }
  } else {
    for (const chunk of resolvedChunks.length ? resolvedChunks : [""]) {
      const response = await postSlackMessageBestEffort({
        client,
        channelId,
        text: chunk,
        threadTs: opts.threadTs,
        replyBroadcast: sentMessageIds.length === 0 ? opts.replyBroadcast : undefined,
        identity: opts.identity,
        metadata: sentMessageIds.length === 0 ? opts.metadata : undefined,
        unfurl,
      });
      lastMessageId = response.ts ?? lastMessageId;
      if (response.ts) {
        sentMessageIds.push(response.ts);
      }
    }
  }

  const messageId = lastMessageId || "unknown";
  return {
    messageId,
    channelId,
    receipt: createSlackSendReceipt({
      platformMessageIds: sentMessageIds.length ? sentMessageIds : [messageId],
      channelId,
      kind: opts.mediaUrl ? "media" : "text",
      threadTs: opts.threadTs,
    }),
  };
}
