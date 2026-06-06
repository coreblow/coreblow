import { finalizeInboundContext } from "../../auto-reply/reply/inbound-context.js";
import type { FinalizedMsgContext } from "../../auto-reply/templating.js";
import type { ContextVisibilityMode } from "../../config/context-visibility.js";
import type { InboundEventKind } from "./kind.js";
import { buildChannelInboundMediaPayload, type InboundMediaFacts } from "./media.js";

export type CommandTurnContext = {
  kind: "normal" | "text-slash" | "native" | string;
  source: "message" | "text" | "native";
  authorized: boolean;
  commandName?: string;
  body: string;
};

export type SenderFacts = {
  id?: string;
  name?: string;
  displayLabel?: string;
  username?: string;
  tag?: string;
  roles?: string[];
};

export type ConversationFacts = {
  kind: "direct" | "group" | "channel" | string;
  id?: string;
  label?: string;
  spaceId?: string;
  threadId?: string | number;
  nativeChannelId?: string;
  parentId?: string;
  routePeer?: unknown;
};

export type RouteFacts = {
  agentId?: string;
  accountId?: string;
  routeSessionKey: string;
  dispatchSessionKey?: string;
  parentSessionKey?: string;
  modelParentSessionKey?: string;
};

export type ReplyPlanFacts = {
  to: string;
  originatingTo?: string;
  replyToId?: string;
  replyToIdFull?: string;
  messageThreadId?: string | number;
  nativeChannelId?: string;
  threadParentId?: string;
};

export type MessageFacts = {
  body?: string;
  bodyForAgent?: string;
  commandBody?: string;
  rawBody: string;
  envelopeFrom?: string;
  inboundHistory?: Array<{ sender: string; body: string; timestamp?: number }>;
  inboundEventKind?: InboundEventKind;
};

export type AccessFacts = {
  commands?: {
    authorized?: boolean;
    authorizers?: Array<{ allowed?: boolean }>;
  };
  mentions?: {
    wasMentioned?: boolean;
  };
};

export type CommandFacts = {
  kind: "normal" | "text-slash" | "native" | string;
  name?: string;
  body?: string;
  authorized?: boolean;
};

export type SupplementalContextFacts = {
  quote?: {
    id?: string;
    fullId?: string;
    body?: string;
    sender?: string;
    isQuote?: boolean;
    senderAllowed?: boolean;
  };
  forwarded?: {
    from?: string;
    fromType?: string;
    fromId?: string;
    date?: number;
    senderAllowed?: boolean;
  };
  thread?: {
    starterBody?: string;
    historyBody?: string;
    label?: string;
    senderAllowed?: boolean;
  };
  groupSystemPrompt?: string;
  untrustedContext?: string[];
};

export type BuildChannelInboundEventContextParams = {
  channel: string;
  accountId?: string;
  provider?: string;
  surface?: string;
  messageId?: string;
  messageIdFull?: string;
  timestamp?: number;
  from: string;
  sender: SenderFacts;
  conversation: ConversationFacts;
  route: RouteFacts;
  reply: ReplyPlanFacts;
  message: MessageFacts;
  access?: AccessFacts;
  command?: CommandFacts;
  commandTurn?: CommandTurnContext;
  media?: InboundMediaFacts[];
  supplemental?: SupplementalContextFacts;
  contextVisibility?: ContextVisibilityMode;
  extra?: Record<string, unknown>;
};

export type BuiltChannelInboundEventContext = FinalizedMsgContext & {
  Body: string;
  BodyForAgent: string;
  BodyForCommands: string;
  ChatType: ConversationFacts["kind"];
  CommandAuthorized: boolean;
  CommandBody: string;
  From: string;
  RawBody: string;
  SessionKey: string;
  To: string;
  InboundEventKind: InboundEventKind;
  CommandTurn?: CommandTurnContext;
};

function keepSupplementalContext(params: {
  mode?: ContextVisibilityMode;
  kind: "quote" | "forwarded" | "thread";
  senderAllowed?: boolean;
}): boolean {
  if (!params.mode || params.mode === "all") {
    return true;
  }
  if (params.senderAllowed === undefined) {
    return false;
  }
  if (params.mode === "allowlist_quote" && params.kind === "quote") {
    return true;
  }
  return params.senderAllowed === true;
}

export function filterChannelInboundSupplementalContext(params: {
  supplemental?: SupplementalContextFacts;
  contextVisibility?: ContextVisibilityMode;
}): SupplementalContextFacts | undefined {
  const supplemental = params.supplemental;
  if (!supplemental) {
    return undefined;
  }
  const quote = keepSupplementalContext({
    mode: params.contextVisibility,
    kind: "quote",
    senderAllowed: supplemental.quote?.senderAllowed,
  })
    ? supplemental.quote
    : undefined;
  const forwarded = keepSupplementalContext({
    mode: params.contextVisibility,
    kind: "forwarded",
    senderAllowed: supplemental.forwarded?.senderAllowed,
  })
    ? supplemental.forwarded
    : undefined;
  const thread = keepSupplementalContext({
    mode: params.contextVisibility,
    kind: "thread",
    senderAllowed: supplemental.thread?.senderAllowed,
  })
    ? supplemental.thread
    : undefined;

  return {
    ...supplemental,
    quote,
    forwarded,
    thread,
  };
}

function resolveAccessFactsCommandAuthorized(access: AccessFacts | undefined): boolean | undefined {
  const commands = access?.commands;
  return typeof commands?.authorized === "boolean"
    ? commands.authorized
    : commands?.authorizers?.some((entry) => entry.allowed);
}

function commandTurnKindToSource(kind: CommandFacts["kind"]): CommandTurnContext["source"] {
  return kind === "native" ? "native" : kind === "normal" ? "message" : "text";
}

function createCommandTurnContext(
  source: CommandTurnContext["source"],
  params: {
    authorized: boolean;
    commandName?: string;
    body: string;
  },
): CommandTurnContext {
  return {
    kind: source === "text" ? "text-slash" : source,
    source,
    authorized: params.authorized,
    commandName: params.commandName,
    body: params.body,
  };
}

function resolveChannelCommandContext(params: {
  command?: CommandFacts;
  commandTurn?: CommandTurnContext;
  message: MessageFacts;
  access?: AccessFacts;
}): CommandTurnContext | undefined {
  if (params.commandTurn) {
    return params.commandTurn;
  }
  const command = params.command;
  if (!command) {
    return undefined;
  }
  const body = command.body ?? params.message.commandBody ?? params.message.rawBody;
  return createCommandTurnContext(commandTurnKindToSource(command.kind), {
    authorized:
      command.kind === "normal"
        ? false
        : (command.authorized ?? resolveAccessFactsCommandAuthorized(params.access) === true),
    commandName: command.name,
    body,
  });
}

export function buildChannelInboundEventContext(
  params: BuildChannelInboundEventContextParams,
): BuiltChannelInboundEventContext {
  const mediaPayload = buildChannelInboundMediaPayload(params.media ?? []);
  const supplemental = filterChannelInboundSupplementalContext({
    supplemental: params.supplemental,
    contextVisibility: params.contextVisibility,
  });
  const body = params.message.body ?? params.message.rawBody;
  const commandTurn = resolveChannelCommandContext({
    command: params.command,
    commandTurn: params.commandTurn,
    message: params.message,
    access: params.access,
  });

  return finalizeInboundContext({
    Body: body,
    InboundEventKind: params.message.inboundEventKind ?? "user_request",
    BodyForAgent: params.message.bodyForAgent ?? params.message.rawBody,
    InboundHistory: params.message.inboundHistory,
    RawBody: params.message.rawBody,
    CommandBody: params.message.commandBody ?? params.message.rawBody,
    BodyForCommands: params.message.commandBody ?? params.message.rawBody,
    From: params.from,
    To: params.reply.to,
    SessionKey: params.route.dispatchSessionKey ?? params.route.routeSessionKey,
    AccountId: params.route.accountId ?? params.accountId,
    ParentSessionKey: params.route.parentSessionKey,
    ModelParentSessionKey: params.route.modelParentSessionKey,
    MessageSid: params.messageId,
    MessageSidFull: params.messageIdFull,
    ReplyToId: params.reply.replyToId ?? supplemental?.quote?.id,
    ReplyToIdFull: params.reply.replyToIdFull ?? supplemental?.quote?.fullId,
    ReplyToBody: supplemental?.quote?.body,
    ReplyToSender: supplemental?.quote?.sender,
    ReplyToIsQuote: supplemental?.quote?.isQuote,
    ForwardedFrom: supplemental?.forwarded?.from,
    ForwardedFromType: supplemental?.forwarded?.fromType,
    ForwardedFromId: supplemental?.forwarded?.fromId,
    ForwardedDate: supplemental?.forwarded?.date,
    ThreadStarterBody: supplemental?.thread?.starterBody,
    ThreadHistoryBody: supplemental?.thread?.historyBody,
    ThreadLabel: supplemental?.thread?.label,
    ...mediaPayload,
    ChatType: params.conversation.kind,
    ConversationLabel: params.conversation.label,
    GroupSubject: params.conversation.kind !== "direct" ? params.conversation.label : undefined,
    GroupSpace: params.conversation.spaceId,
    GroupSystemPrompt: supplemental?.groupSystemPrompt,
    UntrustedContext: supplemental?.untrustedContext,
    SenderName: params.sender.name ?? params.sender.displayLabel,
    SenderId: params.sender.id,
    SenderUsername: params.sender.username,
    SenderTag: params.sender.tag,
    MemberRoleIds: params.sender.roles,
    Timestamp: params.timestamp,
    Provider: params.provider ?? params.channel,
    Surface: params.surface ?? params.provider ?? params.channel,
    WasMentioned: params.access?.mentions?.wasMentioned,
    CommandAuthorized: resolveAccessFactsCommandAuthorized(params.access) === true,
    CommandSource: commandTurn?.source === "text" || commandTurn?.source === "native"
      ? commandTurn.source
      : undefined,
    CommandTurn: commandTurn,
    MessageThreadId: params.reply.messageThreadId ?? params.conversation.threadId,
    NativeChannelId: params.reply.nativeChannelId ?? params.conversation.nativeChannelId,
    OriginatingChannel: params.channel,
    OriginatingTo: params.reply.originatingTo,
    ThreadParentId: params.reply.threadParentId ?? params.conversation.parentId,
    ...params.extra,
  }) as BuiltChannelInboundEventContext;
}
