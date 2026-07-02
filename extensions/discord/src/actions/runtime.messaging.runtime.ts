import { readDiscordComponentSpec } from "../components.js";
import type { CoreBlowConfig } from "../runtime-api.js";
import { sendDiscordComponentMessage } from "../send.components.js";
import {
  createThreadDiscord,
  deleteMessageDiscord,
  editMessageDiscord,
  editChannelDiscord,
  fetchChannelInfoDiscord,
  fetchChannelPermissionsDiscord,
  fetchMessageDiscord,
  fetchReactionsDiscord,
  listPinsDiscord,
  listThreadsDiscord,
  pinMessageDiscord,
  reactMessageDiscord,
  readMessagesDiscord,
  removeOwnReactionsDiscord,
  removeReactionDiscord,
  searchMessagesDiscord,
  sendMessageDiscord,
  sendPollDiscord,
  sendStickerDiscord,
  sendVoiceMessageDiscord,
  unpinMessageDiscord,
} from "../send.js";
import { parseAndResolveDiscordTarget } from "../target-resolver.js";
import { resolveDiscordChannelId } from "../targets.js";

export const discordMessagingActionRuntime = {
  createThreadDiscord,
  deleteMessageDiscord,
  editChannelDiscord,
  editMessageDiscord,
  fetchChannelInfoDiscord,
  fetchChannelPermissionsDiscord,
  fetchMessageDiscord,
  fetchReactionsDiscord,
  listPinsDiscord,
  listThreadsDiscord,
  pinMessageDiscord,
  reactMessageDiscord,
  readDiscordComponentSpec,
  readMessagesDiscord,
  removeOwnReactionsDiscord,
  removeReactionDiscord,
  resolveDiscordReactionTargetChannelId,
  resolveDiscordChannelId,
  searchMessagesDiscord,
  sendDiscordComponentMessage,
  sendMessageDiscord,
  sendPollDiscord,
  sendStickerDiscord,
  sendVoiceMessageDiscord,
  unpinMessageDiscord,
};

async function resolveDiscordReactionTargetChannelId(params: {
  target: string;
  cfg: CoreBlowConfig;
  accountId?: string;
}): Promise<string> {
  try {
    return resolveDiscordChannelId(params.target);
  } catch {
    const resolved = await parseAndResolveDiscordTarget(
      params.target,
      {
        cfg: params.cfg,
        accountId: params.accountId,
      },
      { defaultKind: "channel" },
    );
    if (resolved.kind !== "channel") {
      throw new Error("Discord reaction targets must resolve to a channel.");
    }
    return resolved.id;
  }
}
