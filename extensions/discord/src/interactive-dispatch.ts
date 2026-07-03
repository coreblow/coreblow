import { dispatchPluginInteractiveHandler } from "coreblow/plugin-sdk/plugin-runtime";
import type {
  PluginConversationBinding,
  PluginConversationBindingRequestParams,
  PluginConversationBindingRequestResult,
} from "coreblow/plugin-sdk/plugin-runtime";

export type DiscordInteractiveHandlerContext = {
  channel: "discord";
  accountId: string;
  interactionId: string;
  conversationId: string;
  parentConversationId?: string;
  guildId?: string;
  senderId?: string;
  senderUsername?: string;
  auth: {
    isAuthorizedSender: boolean;
  };
  interaction: {
    kind: "button" | "select" | "modal";
    data: string;
    namespace: string;
    payload: string;
    messageId?: string;
    values?: string[];
    fields?: Array<{ id: string; name: string; values: string[] }>;
  };
  respond: {
    acknowledge: () => Promise<void>;
    reply: (params: { text: string; ephemeral?: boolean }) => Promise<void>;
    followUp: (params: { text: string; ephemeral?: boolean }) => Promise<void>;
    editMessage: (params: { text?: string; components?: unknown[] }) => Promise<void>;
    clearComponents: (params?: { text?: string }) => Promise<void>;
  };
  requestConversationBinding: (
    params?: PluginConversationBindingRequestParams,
  ) => Promise<PluginConversationBindingRequestResult>;
  detachConversationBinding: () => Promise<{ removed: boolean }>;
  getCurrentConversationBinding: () => Promise<PluginConversationBinding | null>;
};

type DiscordInteractiveDispatchContext = Omit<
  DiscordInteractiveHandlerContext,
  | "interaction"
  | "respond"
  | "channel"
  | "requestConversationBinding"
  | "detachConversationBinding"
  | "getCurrentConversationBinding"
> & {
  interaction: Omit<
    DiscordInteractiveHandlerContext["interaction"],
    "data" | "namespace" | "payload"
  >;
};

export async function dispatchDiscordPluginInteractiveHandler(params: {
  data: string;
  interactionId: string;
  ctx: DiscordInteractiveDispatchContext;
  respond: DiscordInteractiveHandlerContext["respond"];
  onMatched?: () => Promise<void> | void;
}): ReturnType<typeof dispatchPluginInteractiveHandler> {
  const { dispatchPluginInteractiveHandler: dispatch } = await import(
    "coreblow/plugin-sdk/plugin-runtime"
  );
  return dispatch({
    channel: "discord",
    data: params.data,
    interactionId: params.interactionId,
    ctx: params.ctx,
    respond: params.respond,
    onMatched: params.onMatched,
  });
}
