import {
  deliverTextOrMediaReply,
  resolveSendableOutboundReplyParts,
} from "coreblow/plugin-sdk/reply-payload";
import type { CoreBlowConfig, PluginRuntime, ReplyPayload } from "../runtime-api.js";
import { getAgentScopedMediaLocalRoots } from "../runtime-api.js";

type MarkdownTableMode = Parameters<PluginRuntime["channel"]["text"]["convertMarkdownTables"]>[1];

type SendMattermostMessage = (
  to: string,
  text: string,
  opts: {
    cfg?: CoreBlowConfig;
    accountId?: string;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
    replyToId?: string;
  },
) => Promise<unknown>;

export type MattermostReplyDeliveryOutcome = "reasoning_skipped" | "empty" | "text" | "media";

export async function deliverMattermostReplyPayload(params: {
  core: PluginRuntime;
  cfg: CoreBlowConfig;
  payload: ReplyPayload;
  to: string;
  accountId: string;
  agentId?: string;
  replyToId?: string;
  textLimit: number;
  tableMode: MarkdownTableMode;
  sendMessage: SendMattermostMessage;
}): Promise<MattermostReplyDeliveryOutcome> {
  if (params.payload.isReasoning) {
    return "reasoning_skipped";
  }
  const reply = resolveSendableOutboundReplyParts(params.payload, {
    text: params.core.channel.text.convertMarkdownTables(
      params.payload.text ?? "",
      params.tableMode,
    ),
  });
  const mediaLocalRoots = getAgentScopedMediaLocalRoots(params.cfg, params.agentId);
  const chunkMode = params.core.channel.text.resolveChunkMode(
    params.cfg,
    "mattermost",
    params.accountId,
  );
  return await deliverTextOrMediaReply({
    payload: params.payload,
    text: reply.text,
    chunkText: (value) =>
      params.core.channel.text.chunkMarkdownTextWithMode(value, params.textLimit, chunkMode),
    sendText: async (chunk) => {
      await params.sendMessage(params.to, chunk, {
        cfg: params.cfg,
        accountId: params.accountId,
        replyToId: params.replyToId,
      });
    },
    sendMedia: async ({ mediaUrl, caption }) => {
      await params.sendMessage(params.to, caption ?? "", {
        cfg: params.cfg,
        accountId: params.accountId,
        mediaUrl,
        mediaLocalRoots,
        replyToId: params.replyToId,
      });
    },
  });
}
