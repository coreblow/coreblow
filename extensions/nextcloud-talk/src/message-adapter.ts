import { defineChannelMessageAdapter } from "coreblow/plugin-sdk/channel-message";
import { sendMessageNextcloudTalk } from "./send.js";
import type { CoreConfig } from "./types.js";

type TextSendParams = {
  cfg: CoreConfig;
  to: string;
  text: string;
  accountId?: string | null;
  replyToId?: string | null;
};
type MediaSendParams = TextSendParams & { mediaUrl?: string | null };

export const nextcloudTalkMessageAdapter = defineChannelMessageAdapter({
  id: "nextcloud-talk",
  durableFinal: { capabilities: { text: true, media: true, replyTo: true } },
  send: {
    text: async ({ cfg, to, text, accountId, replyToId }: TextSendParams) =>
      await sendMessageNextcloudTalk(to, text, {
        cfg: cfg as CoreConfig,
        accountId: accountId ?? undefined,
        replyTo: replyToId ?? undefined,
      }),
    media: async ({ cfg, to, text, mediaUrl, accountId, replyToId }: MediaSendParams) =>
      await sendMessageNextcloudTalk(to, mediaUrl ? `${text}\n\nAttachment: ${mediaUrl}` : text, {
        cfg: cfg as CoreConfig,
        accountId: accountId ?? undefined,
        replyTo: replyToId ?? undefined,
      }),
  },
});
