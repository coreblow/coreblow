import fs from "node:fs/promises";
import path from "node:path";
import { recordChannelActivity } from "coreblow/plugin-sdk/channel-activity-runtime";
import {
  extensionForMime,
  maxBytesForKind,
  unlinkIfExists,
} from "coreblow/plugin-sdk/media-runtime";
import { requireRuntimeConfig } from "coreblow/plugin-sdk/plugin-config-runtime";
import type { RetryConfig } from "coreblow/plugin-sdk/retry-runtime";
import { tempWorkspace, resolvePreferredCoreBlowTmpDir } from "coreblow/plugin-sdk/temp-path";
import { loadWebMediaRaw } from "coreblow/plugin-sdk/web-media";
import { resolveDiscordAccount } from "./accounts.js";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import { createDiscordClient } from "./client.js";
import type { RequestClient } from "@buape/carbon";
import { parseAndResolveRecipient } from "./recipient-resolution.js";
import { createDiscordSendResult } from "./send.receipt.js";
import { buildDiscordSendError, resolveChannelId } from "./send.shared.js";
import type { DiscordSendResult } from "./send.types.js";
import {
  ensureOggOpus,
  getVoiceMessageMetadata,
  sendDiscordVoiceMessage,
} from "./voice-message.js";

type VoiceMessageOpts = {
  cfg: CoreBlowConfig;
  token?: string;
  accountId?: string;
  verbose?: boolean;
  replyTo?: string;
  retry?: RetryConfig;
  silent?: boolean;
};

function toDiscordSendResult(
  result: { id?: string | null; channel_id?: string | null },
  fallbackChannelId: string,
): DiscordSendResult {
  return createDiscordSendResult({
    result,
    fallbackChannelId,
    kind: "voice",
  });
}

async function materializeVoiceMessageInput(
  mediaUrl: string,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  // Security: reuse the standard media loader so we apply SSRF guards + allowed-local-root checks.
  // Then write to a private temp file so ffmpeg/ffprobe never sees the original URL/path string.
  const media = await loadWebMediaRaw(mediaUrl, maxBytesForKind("audio"));
  const extFromName = media.fileName ? path.extname(media.fileName) : "";
  const extFromMime = media.contentType ? extensionForMime(media.contentType) : "";
  const ext = extFromName || extFromMime || ".bin";
  const workspace = await tempWorkspace({
    rootDir: resolvePreferredCoreBlowTmpDir(),
    prefix: "voice-src-",
  });
  const filePath = path.join(workspace.dir, `input${ext}`);
  await fs.writeFile(filePath, media.buffer);
  return { filePath, cleanup: async () => await workspace.cleanup() };
}

/**
 * Send a voice message to Discord.
 *
 * Voice messages are a special Discord feature that displays audio with a waveform
 * visualization. They require OGG/Opus format and cannot include text content.
 *
 * @param to - Recipient (user ID for DM or channel ID)
 * @param audioPath - Path to local audio file (will be converted to OGG/Opus if needed)
 * @param opts - Send options
 */
export async function sendVoiceMessageDiscord(
  to: string,
  audioPath: string,
  opts: VoiceMessageOpts,
): Promise<DiscordSendResult> {
  const { filePath: localInputPath, cleanup: cleanupLocalInput } =
    await materializeVoiceMessageInput(audioPath);
  let oggPath: string | null = null;
  let oggCleanup = false;
  let rest: RequestClient | undefined;
  let channelId: string | undefined;
  const cfg = requireRuntimeConfig(opts.cfg, "Discord voice send");

  try {
    const accountInfo = resolveDiscordAccount({
      cfg,
      accountId: opts.accountId,
    });
    const client = createDiscordClient({ ...opts, cfg });
    const token = client.token;
    rest = client.rest;
    const request = client.request;
    const recipient = await parseAndResolveRecipient(to, cfg, opts.accountId);
    channelId = (await resolveChannelId(rest, recipient, request)).channelId;

    const ogg = await ensureOggOpus(localInputPath);
    oggPath = ogg.path;
    oggCleanup = ogg.cleanup;

    const metadata = await getVoiceMessageMetadata(oggPath);
    const audioBuffer = await fs.readFile(oggPath);
    const result = await sendDiscordVoiceMessage(
      rest,
      channelId,
      audioBuffer,
      metadata,
      opts.replyTo,
      request,
      opts.silent,
      token,
    );

    recordChannelActivity({
      channel: "discord",
      accountId: accountInfo.accountId,
      direction: "outbound",
    });

    return toDiscordSendResult(result, channelId);
  } catch (err) {
    if (channelId && rest) {
      throw await buildDiscordSendError(err, {
        channelId,
        rest,
        token: opts.token ?? "",
        hasMedia: true,
      });
    }
    throw err;
  } finally {
    await unlinkIfExists(oggCleanup ? oggPath : null);
    await cleanupLocalInput();
  }
}
