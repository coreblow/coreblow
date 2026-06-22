import { Type } from "typebox";
import {
  createChannelMessageAdapterFromOutbound,
  defineChannelMessageAdapter,
} from "coreblow/plugin-sdk/channel-message";
import { createMessageToolButtonsSchema } from "coreblow/plugin-sdk/channel-actions";
import type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
} from "coreblow/plugin-sdk/channel-contract";
import { createLoggedPairingApprovalNotifier } from "coreblow/plugin-sdk/channel-pairing";
import { createRestrictSendersChannelSecurity } from "coreblow/plugin-sdk/channel-policy";
import { createChatChannelPlugin } from "coreblow/plugin-sdk/core";
import { createChannelDirectoryAdapter } from "coreblow/plugin-sdk/directory-runtime";
import { buildPassiveProbedChannelStatusSummary } from "coreblow/plugin-sdk/extension-shared";
import {
  createComputedAccountStatusAdapter,
  createDefaultChannelRuntimeState,
} from "coreblow/plugin-sdk/status-helpers";
import { MattermostChannelConfigSchema } from "./config-surface.js";
import { resolveMattermostGroupRequireMention } from "./group-mentions.js";
import {
  listMattermostAccountIds,
  resolveDefaultMattermostAccountId,
  resolveMattermostAccount,
  resolveMattermostReplyToMode,
  type ResolvedMattermostAccount,
} from "./mattermost/accounts.js";
import {
  listMattermostDirectoryGroups,
  listMattermostDirectoryPeers,
} from "./mattermost/directory.js";
import { monitorMattermostProvider } from "./mattermost/monitor.js";
import { probeMattermost } from "./mattermost/probe.js";
import { addMattermostReaction, removeMattermostReaction } from "./mattermost/reactions.js";
import { sendMessageMattermost } from "./mattermost/send.js";
import { resolveMattermostOpaqueTarget } from "./mattermost/target-resolution.js";
import { looksLikeMattermostTargetId, normalizeMattermostMessagingTarget } from "./normalize.js";
import {
  chunkTextForOutbound,
  type CoreBlowConfig,
  createAccountStatusSink,
  DEFAULT_ACCOUNT_ID,
  type ChannelPlugin,
} from "./runtime-api.js";
import {
  describeMattermostAccount,
  isMattermostConfigured,
  mattermostConfigAdapter,
  mattermostMeta,
} from "./channel-config-shared.js";
import { resolveMattermostOutboundSessionRoute } from "./session-route.js";
import { mattermostSetupAdapter } from "./setup-core.js";
import { mattermostSetupWizard } from "./setup-surface.js";
import type { MattermostConfig } from "./types.js";

const mattermostSecurityAdapter = createRestrictSendersChannelSecurity<ResolvedMattermostAccount>({
  channelKey: "mattermost",
  resolveDmPolicy: (account) => account.config.dmPolicy,
  resolveDmAllowFrom: (account) => account.config.allowFrom,
  resolveGroupPolicy: (account) => account.config.groupPolicy,
  surface: "Mattermost channels",
  openScope: "any member",
  groupPolicyPath: "channels.mattermost.groupPolicy",
  groupAllowFromPath: "channels.mattermost.groupAllowFrom",
  policyPathSuffix: "dmPolicy",
  normalizeDmEntry: (raw) => normalizeAllowEntry(raw),
});

function describeMattermostMessageTool({
  cfg,
}: Parameters<
  NonNullable<ChannelMessageActionAdapter["describeMessageTool"]>
>[0]): ChannelMessageToolDiscovery {
  const enabledAccounts = listMattermostAccountIds(cfg)
    .map((accountId) => resolveMattermostAccount({ cfg, accountId }))
    .filter((account) => account.enabled)
    .filter((account) => Boolean(account.botToken?.trim() && account.baseUrl?.trim()));

  const actions: ChannelMessageActionName[] = [];

  if (enabledAccounts.length > 0) {
    actions.push("send");
  }

  const actionsConfig = cfg.channels?.mattermost?.actions as { reactions?: boolean } | undefined;
  const baseReactions = actionsConfig?.reactions;
  const hasReactionCapableAccount = enabledAccounts.some((account) => {
    const accountActions = account.config.actions as { reactions?: boolean } | undefined;
    return (accountActions?.reactions ?? baseReactions ?? true) !== false;
  });
  if (hasReactionCapableAccount) {
    actions.push("react");
  }

  return {
    actions,
    capabilities: enabledAccounts.length > 0 ? ["buttons"] : [],
    schema:
      enabledAccounts.length > 0
        ? {
            properties: {
              buttons: Type.Optional(createMessageToolButtonsSchema() as any),
            },
          } as any
        : null,
  };
}

const mattermostMessageActions: ChannelMessageActionAdapter = {
  describeMessageTool: describeMattermostMessageTool,
  supportsAction: ({ action }) => {
    return action === "send" || action === "react";
  },
  handleAction: async ({ action, params, cfg, accountId }) => {
    if (action === "react") {
      const resolvedAccountId = accountId ?? resolveDefaultMattermostAccountId(cfg);
      const mattermostConfig = cfg.channels?.mattermost as MattermostConfig | undefined;
      const account = resolveMattermostAccount({ cfg, accountId: resolvedAccountId });
      const reactionsEnabled =
        account.config.actions?.reactions ?? mattermostConfig?.actions?.reactions ?? true;
      if (!reactionsEnabled) {
        throw new Error("Mattermost reactions are disabled in config");
      }

      const { postId, emojiName, remove } = parseMattermostReactActionParams(params);
      if (remove) {
        const result = await removeMattermostReaction({
          cfg,
          postId,
          emojiName,
          accountId: resolvedAccountId,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        return {
          content: [
            { type: "text" as const, text: `Removed reaction :${emojiName}: from ${postId}` },
          ],
          details: {},
        };
      }

      const result = await addMattermostReaction({
        cfg,
        postId,
        emojiName,
        accountId: resolvedAccountId,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }

      return {
        content: [{ type: "text" as const, text: `Reacted with :${emojiName}: on ${postId}` }],
        details: {},
      };
    }

    if (action !== "send") {
      throw new Error(`Unsupported Mattermost action: ${action}`);
    }

    // Send action with optional interactive buttons
    const to =
      typeof params.to === "string"
        ? params.to.trim()
        : typeof params.target === "string"
          ? params.target.trim()
          : "";
    if (!to) {
      throw new Error("Mattermost send requires a target (to).");
    }

    const message = typeof params.message === "string" ? params.message : "";
    // Match the shared runner semantics: trim empty reply IDs away before
    // falling back from replyToId to replyTo on direct plugin calls.
    const replyToId = readMattermostReplyToId(params);
    const resolvedAccountId = accountId || undefined;

    const mediaUrl =
      typeof params.media === "string" ? params.media.trim() || undefined : undefined;

    const result = await sendMessageMattermost(to, message, {
      accountId: resolvedAccountId,
      replyToId,
      buttons: Array.isArray(params.buttons) ? params.buttons : undefined,
      attachmentText: typeof params.attachmentText === "string" ? params.attachmentText : undefined,
      mediaUrl,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            channel: "mattermost",
            messageId: result.messageId,
            channelId: result.channelId,
          }),
        },
      ],
      details: {},
    };
  },
};

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseMattermostReactActionParams(params: Record<string, unknown>): {
  postId: string;
  emojiName: string;
  remove: boolean;
} {
  const postId = readTrimmedString(params.messageId) ?? readTrimmedString(params.postId);
  if (!postId) {
    throw new Error("Mattermost react requires messageId (post id)");
  }

  const emojiName = readTrimmedString(params.emoji)?.replace(/^:+|:+$/g, "");
  if (!emojiName) {
    throw new Error("Mattermost react requires emoji");
  }

  return {
    postId,
    emojiName,
    remove: params.remove === true,
  };
}

function readMattermostReplyToId(params: Record<string, unknown>): string | undefined {
  return readTrimmedString(params.replyToId) ?? readTrimmedString(params.replyTo);
}

function normalizeAllowEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^(mattermost|user):/i, "")
    .replace(/^@/, "")
    .toLowerCase();
}

export const mattermostPlugin: ChannelPlugin<ResolvedMattermostAccount> = createChatChannelPlugin({
  base: {
    id: "mattermost",
    meta: {
      ...mattermostMeta,
    },
    setup: mattermostSetupAdapter,
    setupWizard: mattermostSetupWizard,
    capabilities: {
      chatTypes: ["direct", "channel", "group", "thread"],
      reactions: true,
      threads: true,
      media: true,
      nativeCommands: true,
    },
    streaming: {
      blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
    },
    reload: { configPrefixes: ["channels.mattermost"] },
    configSchema: MattermostChannelConfigSchema,
    config: {
      ...mattermostConfigAdapter,
      isConfigured: isMattermostConfigured,
      describeAccount: describeMattermostAccount,
    },
    groups: {
      resolveRequireMention: resolveMattermostGroupRequireMention,
    },
    actions: mattermostMessageActions,
    directory: createChannelDirectoryAdapter({
      listGroups: async (params) => listMattermostDirectoryGroups(params),
      listGroupsLive: async (params) => listMattermostDirectoryGroups(params),
      listPeers: async (params) => listMattermostDirectoryPeers(params),
      listPeersLive: async (params) => listMattermostDirectoryPeers(params),
    }),
    messaging: {
      normalizeTarget: normalizeMattermostMessagingTarget,
      resolveOutboundSessionRoute: (params) => resolveMattermostOutboundSessionRoute(params),
      targetResolver: {
        looksLikeId: looksLikeMattermostTargetId,
        hint: "<channelId|user:ID|channel:ID>",
        resolveTarget: async ({ cfg, accountId, input }) => {
          const resolved = await resolveMattermostOpaqueTarget({
            input,
            cfg,
            accountId,
          });
          if (!resolved) {
            return null;
          }
          return {
            to: resolved.to,
            kind: resolved.kind,
            source: "directory",
          };
        },
      },
    },
    status: createComputedAccountStatusAdapter<ResolvedMattermostAccount>({
      defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID, {
        connected: false,
        lastConnectedAt: null,
        lastDisconnect: null,
      }),
      buildChannelSummary: ({ snapshot }) =>
        buildPassiveProbedChannelStatusSummary(snapshot, {
          botTokenSource: snapshot.botTokenSource ?? "none",
          connected: snapshot.connected ?? false,
          baseUrl: snapshot.baseUrl ?? null,
        }),
      probeAccount: async ({ account, timeoutMs }) => {
        const token = account.botToken?.trim();
        const baseUrl = account.baseUrl?.trim();
        if (!token || !baseUrl) {
          return { ok: false, error: "bot token or baseUrl missing" };
        }
        return await probeMattermost(baseUrl, token, timeoutMs);
      },
      resolveAccountSnapshot: ({ account, runtime }) => ({
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: Boolean(account.botToken && account.baseUrl),
        extra: {
          botTokenSource: account.botTokenSource,
          baseUrl: account.baseUrl,
          connected: runtime?.connected ?? false,
          lastConnectedAt: runtime?.lastConnectedAt ?? null,
          lastDisconnect: runtime?.lastDisconnect ?? null,
        },
      }),
    }),
    gateway: {
      startAccount: async (ctx) => {
        const account = ctx.account;
        const statusSink = createAccountStatusSink({
          accountId: ctx.accountId,
          setStatus: ctx.setStatus,
        });
        statusSink({
          baseUrl: account.baseUrl,
          botTokenSource: account.botTokenSource,
        });
        ctx.log?.info(`[${account.accountId}] starting channel`);
        return monitorMattermostProvider({
          botToken: account.botToken ?? undefined,
          baseUrl: account.baseUrl ?? undefined,
          accountId: account.accountId,
          config: ctx.cfg,
          runtime: ctx.runtime,
          abortSignal: ctx.abortSignal,
          statusSink,
        });
      },
    },
  },
  pairing: {
    text: {
      idLabel: "mattermostUserId",
      message: "CoreBlow: your access has been approved.",
      normalizeAllowEntry: (entry) => normalizeAllowEntry(entry),
      notify: createLoggedPairingApprovalNotifier(
        ({ id }) => `[mattermost] User ${id} approved for pairing`,
      ),
    },
  },
  threading: {
    scopedAccountReplyToMode: {
      resolveAccount: (cfg, accountId) =>
        resolveMattermostAccount({ cfg, accountId: accountId ?? "default" }),
      resolveReplyToMode: (account, chatType) =>
        resolveMattermostReplyToMode(
          account,
          chatType === "direct" || chatType === "group" || chatType === "channel"
            ? chatType
            : "channel",
        ),
    },
  },
  security: mattermostSecurityAdapter,
  outbound: {
    base: {
      deliveryMode: "direct",
      chunker: chunkTextForOutbound,
      chunkerMode: "markdown",
      textChunkLimit: 4000,
      resolveTarget: ({ to }) => {
        const trimmed = to?.trim();
        if (!trimmed) {
          return {
            ok: false,
            error: new Error(
              "Delivering to Mattermost requires --to <channelId|@username|user:ID|channel:ID>",
            ),
          };
        }
        return { ok: true, to: trimmed };
      },
    },
    attachedResults: {
      channel: "mattermost",
      sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) =>
        await sendMessageMattermost(to, text, {
          cfg,
          accountId: accountId ?? undefined,
          replyToId: replyToId ?? (threadId != null ? String(threadId) : undefined),
        }),
      sendMedia: async ({
        cfg,
        to,
        text,
        mediaUrl,
        mediaLocalRoots,
        accountId,
        replyToId,
        threadId,
      }) =>
        await sendMessageMattermost(to, text, {
          cfg,
          accountId: accountId ?? undefined,
          mediaUrl,
          mediaLocalRoots,
          replyToId: replyToId ?? (threadId != null ? String(threadId) : undefined),
        }),
    },
  },
});

function readMattermostPresentationButtons(payload: {
  channelData?: Record<string, unknown>;
}): Array<unknown> | undefined {
  const buttons = (payload.channelData?.mattermost as { presentationButtons?: unknown } | undefined)
    ?.presentationButtons;
  return Array.isArray(buttons) ? buttons : undefined;
}

const mattermostMessageAdapter = defineChannelMessageAdapter(
  createChannelMessageAdapterFromOutbound<CoreBlowConfig>({
    outbound: {
      deliveryCapabilities: {
        durableFinal: {
          text: true,
          media: true,
          payload: true,
          replyTo: true,
          thread: true,
        },
      },
      sendText: async ({ cfg, to, text, accountId, replyToId, threadId }) =>
        await sendMessageMattermost(to, text, {
          cfg,
          accountId: accountId ?? undefined,
          replyToId: replyToId ?? (threadId != null ? String(threadId) : undefined),
        }),
      sendMedia: async ({
        cfg,
        to,
        text,
        mediaUrl,
        mediaLocalRoots,
        accountId,
        replyToId,
        threadId,
      }) =>
        await sendMessageMattermost(to, text, {
          cfg,
          accountId: accountId ?? undefined,
          mediaUrl,
          mediaLocalRoots,
          replyToId: replyToId ?? (threadId != null ? String(threadId) : undefined),
        }),
      sendPayload: async ({
        cfg,
        to,
        text,
        payload,
        mediaUrl,
        mediaLocalRoots,
        accountId,
        replyToId,
        threadId,
      }) =>
        await sendMessageMattermost(to, text, {
          cfg,
          accountId: accountId ?? undefined,
          mediaUrl: mediaUrl ?? payload.mediaUrl ?? payload.mediaUrls?.[0],
          mediaLocalRoots,
          replyToId: replyToId ?? (threadId != null ? String(threadId) : undefined),
          buttons: readMattermostPresentationButtons(payload),
        }),
    },
    live: {
      capabilities: {
        draftPreview: true,
        previewFinalization: true,
        progressUpdates: true,
      },
      finalizer: {
        capabilities: {
          finalEdit: true,
          normalFallback: true,
          discardPending: true,
        },
      },
    },
  }),
);

(mattermostPlugin as typeof mattermostPlugin & { message?: typeof mattermostMessageAdapter }).message =
  mattermostMessageAdapter;

/**
 * Channel implementation used by mattermost runtime for per-channel state.
 */
export class MattermostChannelImpl {
  readonly id: string;
  private connected = false;
  private token: string | undefined;

  constructor(id: string) {
    this.id = id;
  }

  async connect(token?: string): Promise<void> {
    this.token = token?.trim() || undefined;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.token = undefined;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendMessage(content: string): Promise<{ content: string; connected: boolean }> {
    return {
      content,
      connected: this.connected,
    };
  }

  async editMessage(messageId: string, content: string): Promise<{
    edited: boolean;
    messageId: string;
    content: string;
  }> {
    return {
      edited: true,
      messageId,
      content,
    };
  }

  async deleteMessage(messageId: string): Promise<{ deleted: boolean; messageId: string }> {
    return {
      deleted: true,
      messageId,
    };
  }

  async addReaction(messageId: string, reaction: string): Promise<{
    added: boolean;
    messageId: string;
    reaction: string;
  }> {
    return {
      added: true,
      messageId,
      reaction,
    };
  }

  async removeReaction(messageId: string, reaction: string): Promise<{
    removed: boolean;
    messageId: string;
    reaction: string;
  }> {
    return {
      removed: true,
      messageId,
      reaction,
    };
  }
}
