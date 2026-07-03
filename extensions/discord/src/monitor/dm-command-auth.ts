import {
  createChannelIngressResolver,
  defineStableChannelIngressIdentity,
  readChannelIngressStoreAllowFromForDmPolicy,
  type ChannelIngressResolver,
  type ChannelIngressIdentitySubjectInput,
  type CreateChannelIngressResolverParams,
  type ResolvedChannelMessageIngress,
  type ChannelIngressEventInput,
  type ChannelIngressIdentifierKind,
} from "coreblow/plugin-sdk/channel-ingress-runtime";
import { canViewDiscordGuildChannel } from "../send.permissions.js";
import type { DiscordReactOpts } from "../send.types.js";
import { normalizeDiscordAllowList } from "./allow-list.js";

const DISCORD_ALLOW_LIST_PREFIXES = ["discord:", "user:", "pk:"];
const DISCORD_CHANNEL_ID = "discord";
const DISCORD_USER_ID_KIND = "stable-id" satisfies ChannelIngressIdentifierKind;
const DISCORD_USER_NAME_KIND = "username" satisfies ChannelIngressIdentifierKind;

export type DiscordDmPolicy = "open" | "pairing" | "allowlist" | "disabled";

export type DiscordDmCommandAccess = ResolvedChannelMessageIngress["senderAccess"];

function normalizeDiscordIdEntry(entry: string): string | null {
  const text = entry.trim();
  if (!text) {
    return null;
  }
  const maybeId = text.replace(/^<@!?/, "").replace(/>$/, "");
  if (/^\d+$/.test(maybeId)) {
    return maybeId;
  }
  const prefix = DISCORD_ALLOW_LIST_PREFIXES.find((entryPrefix) => text.startsWith(entryPrefix));
  if (prefix) {
    const candidate = text.slice(prefix.length).trim();
    return candidate || null;
  }
  return null;
}

function normalizeDiscordNameEntry(entry: string): string | null {
  const text = entry.trim();
  if (!text || text === "*" || normalizeDiscordIdEntry(text)) {
    return null;
  }
  const nameSlug = normalizeDiscordAllowList([text], DISCORD_ALLOW_LIST_PREFIXES)
    ?.names.values()
    .next().value;
  return typeof nameSlug === "string" && nameSlug ? nameSlug : null;
}

function normalizeDiscordNameSubject(value: string): string | null {
  const nameSlug = normalizeDiscordAllowList([value], DISCORD_ALLOW_LIST_PREFIXES)
    ?.names.values()
    .next().value;
  return typeof nameSlug === "string" && nameSlug ? nameSlug : null;
}

const discordIngressIdentity = defineStableChannelIngressIdentity({
  key: "discordUserId",
  kind: DISCORD_USER_ID_KIND,
  normalizeEntry: normalizeDiscordIdEntry,
  normalizeSubject: (value) => value.trim() || null,
  sensitivity: "pii",
  aliases: (
    [
      ["discordUserName", normalizeDiscordNameEntry],
      ["discordUserTag", () => null],
    ] as const
  ).map(([key, normalizeEntry]) => ({
    key,
    kind: DISCORD_USER_NAME_KIND,
    normalizeEntry,
    normalizeSubject: normalizeDiscordNameSubject,
    dangerous: true,
    sensitivity: "pii",
  })),
});

function createDiscordDmIngressSubject(sender: {
  id: string;
  name?: string;
  tag?: string;
}): ChannelIngressIdentitySubjectInput {
  return {
    stableId: sender.id,
    aliases: {
      discordUserName: sender.name,
      discordUserTag: sender.tag,
    },
  };
}

function createDiscordDynamicAccessGroupResolver(params: {
  cfg?: CreateChannelIngressResolverParams["cfg"];
  token?: string;
  rest?: DiscordReactOpts["rest"];
}): CreateChannelIngressResolverParams["resolveAccessGroupMembership"] {
  if (!params.cfg) {
    return undefined;
  }
  const cfg = params.cfg;
  return async ({ name, group, accountId, subject }) => {
    if (group.type !== "discord.channelAudience") {
      return false;
    }
    const senderId = String(subject.stableId ?? "").trim();
    if (!senderId) {
      return false;
    }
    const membership = group.membership ?? "canViewChannel";
    if (membership !== "canViewChannel") {
      return false;
    }
    try {
      return await canViewDiscordGuildChannel(group.guildId, group.channelId, senderId, {
        cfg: cfg as any,
        accountId,
        token: params.token,
        rest: params.rest,
      });
    } catch (err) {
      throw err;
    }
  };
}

function createDiscordIngressResolver(params: {
  accountId: string;
  cfg?: CreateChannelIngressResolverParams["cfg"];
  token?: string;
  rest?: DiscordReactOpts["rest"];
  readStoreAllowFrom?: CreateChannelIngressResolverParams["readStoreAllowFrom"];
  useDefaultPairingStore?: boolean;
}): ChannelIngressResolver {
  return createChannelIngressResolver({
    channelId: DISCORD_CHANNEL_ID,
    accountId: params.accountId,
    identity: discordIngressIdentity,
    cfg: params.cfg,
    resolveAccessGroupMembership: createDiscordDynamicAccessGroupResolver({
      cfg: params.cfg,
      token: params.token,
      rest: params.rest,
    }),
    ...(params.readStoreAllowFrom ? { readStoreAllowFrom: params.readStoreAllowFrom } : {}),
    ...(params.useDefaultPairingStore !== undefined
      ? { useDefaultPairingStore: params.useDefaultPairingStore }
      : {}),
  });
}

export async function resolveDiscordDmCommandAccess(params: {
  accountId: string;
  dmPolicy: DiscordDmPolicy;
  configuredAllowFrom: string[];
  sender: { id: string; name?: string; tag?: string };
  allowNameMatching: boolean;
  cfg?: CreateChannelIngressResolverParams["cfg"];
  token?: string;
  rest?: DiscordReactOpts["rest"];
  readStoreAllowFrom?: CreateChannelIngressResolverParams["readStoreAllowFrom"];
  eventKind?: ChannelIngressEventInput["kind"];
}): Promise<ResolvedChannelMessageIngress> {
  return await createDiscordIngressResolver({
    accountId: params.accountId,
    cfg: params.cfg,
    token: params.token,
    rest: params.rest,
    readStoreAllowFrom: params.readStoreAllowFrom,
    useDefaultPairingStore: params.readStoreAllowFrom == null,
  }).message({
    subject: createDiscordDmIngressSubject(params.sender),
    conversation: {
      kind: "direct",
      id: params.sender.id,
    },
    event: {
      kind: params.eventKind ?? "native-command",
      authMode: "inbound",
      mayPair: true,
    },
    dmPolicy: params.dmPolicy,
    groupPolicy: "disabled",
    policy: {
      mutableIdentifierMatching: params.allowNameMatching ? "enabled" : "disabled",
    },
    allowFrom: params.configuredAllowFrom,
    command: {
      hasControlCommand: false,
      modeWhenAccessGroupsOff: "configured",
    },
  });
}
