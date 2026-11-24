/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { CoreBlowConfig } from "../config/config.js";
import type { DiscordAccountConfig } from "../config/types.discord.js";
import type { ChannelGroupContext } from "../channels/plugins/types.js";
import type { BaseProbeResult } from "../channels/plugins/types.core.js";
import type { GroupToolPolicyConfig } from "../config/types.tools.js";
import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

export type DiscordComponentMessageSpec = Record<string, unknown>;
export type DiscordProbe = BaseProbeResult<string> & Record<string, unknown>;
export type DiscordSendComponents = unknown;
export type DiscordSendEmbeds = unknown;
export type DiscordSendResult = {
  messageId: string;
  channelId: string;
  [key: string]: unknown;
};
export type DiscordTokenResolution = {
  token: string;
  source: "env" | "config" | "none";
};
export type InspectedDiscordAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  tokenStatus: "available" | "configured_unavailable" | "missing";
  configured: boolean;
  config: DiscordAccountConfig;
};
export type ResolvedDiscordAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  config: DiscordAccountConfig;
};

type DiscordExecApprovalParams = {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  senderId?: string | null;
};

type FacadeModule = {
  buildDiscordComponentMessage: (...args: unknown[]) => unknown;
  collectDiscordStatusIssues: (...args: unknown[]) => unknown[];
  createDiscordActionGate: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
  }) => (key: string, defaultValue?: boolean) => boolean;
  handleDiscordMessageAction: (...args: unknown[]) => Promise<unknown>;
  inspectDiscordAccount: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
    envToken?: string | null;
  }) => InspectedDiscordAccount;
  isDiscordExecApprovalApprover: (params: DiscordExecApprovalParams) => boolean;
  isDiscordExecApprovalClientEnabled: (params: DiscordExecApprovalParams) => boolean;
  listDiscordAccountIds: (cfg: CoreBlowConfig) => string[];
  listDiscordDirectoryGroupsFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  listDiscordDirectoryPeersFromConfig: (...args: unknown[]) => Promise<unknown[]>;
  looksLikeDiscordTargetId: (raw: string) => boolean;
  normalizeDiscordMessagingTarget: (raw: string) => string | undefined;
  normalizeDiscordOutboundTarget: (raw: string) => string | undefined;
  readDiscordComponentSpec: (...args: unknown[]) => DiscordComponentMessageSpec | undefined;
  resolveDefaultDiscordAccountId: (cfg: CoreBlowConfig) => string;
  resolveDiscordAccount: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
  }) => ResolvedDiscordAccount;
  resolveDiscordChannelId: (raw: string) => string;
  resolveDiscordRuntimeGroupPolicy: (...args: unknown[]) => unknown;
  resolveDiscordGroupRequireMention: (params: ChannelGroupContext) => boolean;
  resolveDiscordGroupToolPolicy: (params: ChannelGroupContext) => GroupToolPolicyConfig | undefined;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "discord",
    artifactBasename: "api.js",
  });
}

export const buildDiscordComponentMessage: FacadeModule["buildDiscordComponentMessage"] =
  createLazyFacadeValue(loadFacadeModule, "buildDiscordComponentMessage");
export const collectDiscordStatusIssues: FacadeModule["collectDiscordStatusIssues"] =
  createLazyFacadeValue(loadFacadeModule, "collectDiscordStatusIssues");
export const createDiscordActionGate: FacadeModule["createDiscordActionGate"] =
  createLazyFacadeValue(loadFacadeModule, "createDiscordActionGate");
export const handleDiscordMessageAction: FacadeModule["handleDiscordMessageAction"] =
  createLazyFacadeValue(loadFacadeModule, "handleDiscordMessageAction");
export const inspectDiscordAccount: FacadeModule["inspectDiscordAccount"] =
  createLazyFacadeValue(loadFacadeModule, "inspectDiscordAccount");
export const isDiscordExecApprovalApprover: FacadeModule["isDiscordExecApprovalApprover"] =
  createLazyFacadeValue(loadFacadeModule, "isDiscordExecApprovalApprover");
export const isDiscordExecApprovalClientEnabled: FacadeModule["isDiscordExecApprovalClientEnabled"] =
  createLazyFacadeValue(loadFacadeModule, "isDiscordExecApprovalClientEnabled");
export const listDiscordAccountIds: FacadeModule["listDiscordAccountIds"] =
  createLazyFacadeValue(loadFacadeModule, "listDiscordAccountIds");
export const listDiscordDirectoryGroupsFromConfig: FacadeModule["listDiscordDirectoryGroupsFromConfig"] =
  createLazyFacadeValue(loadFacadeModule, "listDiscordDirectoryGroupsFromConfig");
export const listDiscordDirectoryPeersFromConfig: FacadeModule["listDiscordDirectoryPeersFromConfig"] =
  createLazyFacadeValue(loadFacadeModule, "listDiscordDirectoryPeersFromConfig");
export const looksLikeDiscordTargetId: FacadeModule["looksLikeDiscordTargetId"] =
  createLazyFacadeValue(loadFacadeModule, "looksLikeDiscordTargetId");
export const normalizeDiscordMessagingTarget: FacadeModule["normalizeDiscordMessagingTarget"] =
  createLazyFacadeValue(loadFacadeModule, "normalizeDiscordMessagingTarget");
export const normalizeDiscordOutboundTarget: FacadeModule["normalizeDiscordOutboundTarget"] =
  createLazyFacadeValue(loadFacadeModule, "normalizeDiscordOutboundTarget");
export const readDiscordComponentSpec: FacadeModule["readDiscordComponentSpec"] =
  createLazyFacadeValue(loadFacadeModule, "readDiscordComponentSpec");
export const resolveDefaultDiscordAccountId: FacadeModule["resolveDefaultDiscordAccountId"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDefaultDiscordAccountId");
export const resolveDiscordAccount: FacadeModule["resolveDiscordAccount"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDiscordAccount");
export const resolveDiscordChannelId: FacadeModule["resolveDiscordChannelId"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDiscordChannelId");
export const resolveDiscordRuntimeGroupPolicy: FacadeModule["resolveDiscordRuntimeGroupPolicy"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDiscordRuntimeGroupPolicy");
export const resolveDiscordGroupRequireMention: FacadeModule["resolveDiscordGroupRequireMention"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDiscordGroupRequireMention");
export const resolveDiscordGroupToolPolicy: FacadeModule["resolveDiscordGroupToolPolicy"] =
  createLazyFacadeValue(loadFacadeModule, "resolveDiscordGroupToolPolicy");
