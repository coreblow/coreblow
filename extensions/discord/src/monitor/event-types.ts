/**
 * Typed Discord event types that can be imported without @ts-nocheck.
 * These mirror the Carbon ListenerEventData types for MessageCreate.
 */
import type { Guild, GuildMember, Message, User } from "@buape/carbon";
import type { GatewayMessageCreateDispatchData } from "discord-api-types/v10";

/**
 * Discord message-create event data — the resolved (enhanced) version
 * that Carbon's MessageCreateListener.handle() receives.
 */
export type DiscordMessageEvent = Omit<
  GatewayMessageCreateDispatchData,
  "member" | "author"
> & {
  guild?: Guild;
  member?: GuildMember;
  author: User;
  message: Message;
  rawMessage: GatewayMessageCreateDispatchData;
  rawMember: GatewayMessageCreateDispatchData["member"];
  rawAuthor: GatewayMessageCreateDispatchData["author"];
};

export type DiscordMessageHandler = (
  data: DiscordMessageEvent,
  client: import("@buape/carbon").Client,
  options?: { abortSignal?: AbortSignal },
) => Promise<void>;
