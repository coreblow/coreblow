import type { BaseProbeResult } from "../channels/plugins/types.core.js";
import type { CoreBlowConfig } from "../config/config.js";

export type Action = Record<string, unknown>;
export type CardAction = { label: string; data?: string; uri?: string; type?: string };
export type FlexBox = Record<string, unknown>;
export type FlexBubble = Record<string, unknown>;
export type FlexButton = Record<string, unknown>;
export type FlexCarousel = Record<string, unknown>;
export type FlexComponent = Record<string, unknown>;
export type FlexContainer = Record<string, unknown>;
export type FlexImage = Record<string, unknown>;
export type FlexText = Record<string, unknown>;
export type ListItem = { title: string; subtitle?: string; action?: CardAction };

export type CreateRichMenuParams = Record<string, unknown>;
export type RichMenuArea = Record<string, unknown>;
export type RichMenuAreaRequest = Record<string, unknown>;
export type RichMenuRequest = Record<string, unknown>;
export type RichMenuResponse = Record<string, unknown>;
export type RichMenuSize = { width: number; height: number };

export type LineTokenSource = "config" | "env" | "file" | "none";

interface LineAccountBaseConfig {
  enabled?: boolean;
  channelAccessToken?: string;
  channelSecret?: string;
  tokenFile?: string;
  secretFile?: string;
  name?: string;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  groupPolicy?: "open" | "allowlist" | "disabled";
  responsePrefix?: string;
  mediaMaxMb?: number;
  webhookPath?: string;
  groups?: Record<string, Record<string, unknown>>;
}

export interface LineConfig extends LineAccountBaseConfig {
  accounts?: Record<string, LineAccountBaseConfig>;
  defaultAccount?: string;
}

export interface ResolvedLineAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  channelAccessToken: string;
  channelSecret: string;
  tokenSource: LineTokenSource;
  config: LineConfig & LineAccountBaseConfig;
}

export type LineProbeResult = BaseProbeResult<string> & {
  bot?: {
    displayName?: string;
    userId?: string;
    basicId?: string;
    pictureUrl?: string;
  };
};

export type LineFlexMessagePayload = {
  altText: string;
  contents: unknown;
};

export type LineTemplateMessagePayload = Record<string, unknown>;

export type LineChannelData = {
  quickReplies?: string[];
  location?: {
    title: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  flexMessage?: LineFlexMessagePayload;
  templateMessage?: LineTemplateMessagePayload;
};

export type LineCardFn = (params: Record<string, unknown>) => FlexContainer;
export type LineAsyncFn = (...args: unknown[]) => Promise<unknown>;
export type LineSyncFn = (...args: unknown[]) => unknown;

export type LineRuntimeFacadeModule = {
  LineConfigSchema: Record<string, unknown>;
  buildTemplateMessageFromPayload: LineSyncFn;
  cancelDefaultRichMenu: LineAsyncFn;
  createActionCard: LineCardFn;
  createAgendaCard: LineCardFn;
  createAppleTvRemoteCard: LineCardFn;
  createCarousel: LineSyncFn;
  createDefaultMenuConfig: LineSyncFn;
  createDeviceControlCard: LineCardFn;
  createEventCard: LineCardFn;
  createGridLayout: LineSyncFn;
  createImageCard: LineCardFn;
  createInfoCard: LineCardFn;
  createListCard: LineCardFn;
  createMediaPlayerCard: LineCardFn;
  createNotificationBubble: LineCardFn;
  createQuickReplyItems: LineSyncFn;
  createReceiptCard: LineCardFn;
  createRichMenu: LineAsyncFn;
  createRichMenuAlias: LineAsyncFn;
  datetimePickerAction: LineSyncFn;
  deleteRichMenu: LineAsyncFn;
  deleteRichMenuAlias: LineAsyncFn;
  downloadLineMedia: LineAsyncFn;
  firstDefined: LineSyncFn;
  getDefaultRichMenuId: LineAsyncFn;
  getRichMenu: LineAsyncFn;
  getRichMenuIdOfUser: LineAsyncFn;
  getRichMenuList: LineAsyncFn;
  isSenderAllowed: LineSyncFn;
  linkRichMenuToUser: LineAsyncFn;
  linkRichMenuToUsers: LineAsyncFn;
  listLineAccountIds: (cfg: CoreBlowConfig) => string[];
  messageAction: LineSyncFn;
  monitorLineProvider: LineAsyncFn;
  normalizeAccountId: (accountId?: string | null) => string;
  normalizeAllowFrom: LineSyncFn;
  normalizeDmAllowFromWithStore: LineSyncFn;
  postbackAction: LineSyncFn;
  probeLineBot: LineAsyncFn;
  processLineMessage: LineAsyncFn;
  pushFlexMessage: LineAsyncFn;
  pushLocationMessage: LineAsyncFn;
  pushMessageLine: LineAsyncFn;
  pushMessagesLine: LineAsyncFn;
  pushTemplateMessage: LineAsyncFn;
  pushTextMessageWithQuickReplies: LineAsyncFn;
  resolveDefaultLineAccountId: (cfg: CoreBlowConfig) => string;
  resolveExactLineGroupConfigKey: LineSyncFn;
  resolveLineAccount: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
  }) => ResolvedLineAccount;
  sendMessageLine: LineAsyncFn;
  setDefaultRichMenu: LineAsyncFn;
  toFlexMessage: LineSyncFn;
  unlinkRichMenuFromUser: LineAsyncFn;
  unlinkRichMenuFromUsers: LineAsyncFn;
  uploadRichMenuImage: LineAsyncFn;
  uriAction: LineSyncFn;
};
