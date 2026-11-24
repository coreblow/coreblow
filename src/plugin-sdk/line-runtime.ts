import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";
import type {
  Action,
  CardAction,
  CreateRichMenuParams,
  FlexBox,
  FlexBubble,
  FlexButton,
  FlexCarousel,
  FlexComponent,
  FlexContainer,
  FlexImage,
  FlexText,
  LineChannelData,
  LineConfig,
  LineProbeResult,
  LineRuntimeFacadeModule,
  ListItem,
  ResolvedLineAccount,
  RichMenuArea,
  RichMenuAreaRequest,
  RichMenuRequest,
  RichMenuResponse,
  RichMenuSize,
} from "./line.types.js";

export type {
  Action,
  CardAction,
  CreateRichMenuParams,
  FlexBox,
  FlexBubble,
  FlexButton,
  FlexCarousel,
  FlexComponent,
  FlexContainer,
  FlexImage,
  FlexText,
  LineChannelData,
  LineConfig,
  LineProbeResult,
  ListItem,
  ResolvedLineAccount,
  RichMenuArea,
  RichMenuAreaRequest,
  RichMenuRequest,
  RichMenuResponse,
  RichMenuSize,
};

function loadFacadeModule(): LineRuntimeFacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<LineRuntimeFacadeModule>({
    dirName: "line",
    artifactBasename: "runtime-api.js",
  });
}

export const buildTemplateMessageFromPayload: LineRuntimeFacadeModule["buildTemplateMessageFromPayload"] = createLazyFacadeValue(loadFacadeModule, "buildTemplateMessageFromPayload");
export const cancelDefaultRichMenu: LineRuntimeFacadeModule["cancelDefaultRichMenu"] = createLazyFacadeValue(loadFacadeModule, "cancelDefaultRichMenu");
export const createActionCard: LineRuntimeFacadeModule["createActionCard"] = createLazyFacadeValue(loadFacadeModule, "createActionCard");
export const createAgendaCard: LineRuntimeFacadeModule["createAgendaCard"] = createLazyFacadeValue(loadFacadeModule, "createAgendaCard");
export const createAppleTvRemoteCard: LineRuntimeFacadeModule["createAppleTvRemoteCard"] = createLazyFacadeValue(loadFacadeModule, "createAppleTvRemoteCard");
export const createCarousel: LineRuntimeFacadeModule["createCarousel"] = createLazyFacadeValue(loadFacadeModule, "createCarousel");
export const createDefaultMenuConfig: LineRuntimeFacadeModule["createDefaultMenuConfig"] = createLazyFacadeValue(loadFacadeModule, "createDefaultMenuConfig");
export const createDeviceControlCard: LineRuntimeFacadeModule["createDeviceControlCard"] = createLazyFacadeValue(loadFacadeModule, "createDeviceControlCard");
export const createEventCard: LineRuntimeFacadeModule["createEventCard"] = createLazyFacadeValue(loadFacadeModule, "createEventCard");
export const createGridLayout: LineRuntimeFacadeModule["createGridLayout"] = createLazyFacadeValue(loadFacadeModule, "createGridLayout");
export const createImageCard: LineRuntimeFacadeModule["createImageCard"] = createLazyFacadeValue(loadFacadeModule, "createImageCard");
export const createInfoCard: LineRuntimeFacadeModule["createInfoCard"] = createLazyFacadeValue(loadFacadeModule, "createInfoCard");
export const createListCard: LineRuntimeFacadeModule["createListCard"] = createLazyFacadeValue(loadFacadeModule, "createListCard");
export const createMediaPlayerCard: LineRuntimeFacadeModule["createMediaPlayerCard"] = createLazyFacadeValue(loadFacadeModule, "createMediaPlayerCard");
export const createNotificationBubble: LineRuntimeFacadeModule["createNotificationBubble"] = createLazyFacadeValue(loadFacadeModule, "createNotificationBubble");
export const createQuickReplyItems: LineRuntimeFacadeModule["createQuickReplyItems"] = createLazyFacadeValue(loadFacadeModule, "createQuickReplyItems");
export const createReceiptCard: LineRuntimeFacadeModule["createReceiptCard"] = createLazyFacadeValue(loadFacadeModule, "createReceiptCard");
export const createRichMenu: LineRuntimeFacadeModule["createRichMenu"] = createLazyFacadeValue(loadFacadeModule, "createRichMenu");
export const createRichMenuAlias: LineRuntimeFacadeModule["createRichMenuAlias"] = createLazyFacadeValue(loadFacadeModule, "createRichMenuAlias");
export const datetimePickerAction: LineRuntimeFacadeModule["datetimePickerAction"] = createLazyFacadeValue(loadFacadeModule, "datetimePickerAction");
export const deleteRichMenu: LineRuntimeFacadeModule["deleteRichMenu"] = createLazyFacadeValue(loadFacadeModule, "deleteRichMenu");
export const deleteRichMenuAlias: LineRuntimeFacadeModule["deleteRichMenuAlias"] = createLazyFacadeValue(loadFacadeModule, "deleteRichMenuAlias");
export const downloadLineMedia: LineRuntimeFacadeModule["downloadLineMedia"] = createLazyFacadeValue(loadFacadeModule, "downloadLineMedia");
export const firstDefined: LineRuntimeFacadeModule["firstDefined"] = createLazyFacadeValue(loadFacadeModule, "firstDefined");
export const getDefaultRichMenuId: LineRuntimeFacadeModule["getDefaultRichMenuId"] = createLazyFacadeValue(loadFacadeModule, "getDefaultRichMenuId");
export const getRichMenu: LineRuntimeFacadeModule["getRichMenu"] = createLazyFacadeValue(loadFacadeModule, "getRichMenu");
export const getRichMenuIdOfUser: LineRuntimeFacadeModule["getRichMenuIdOfUser"] = createLazyFacadeValue(loadFacadeModule, "getRichMenuIdOfUser");
export const getRichMenuList: LineRuntimeFacadeModule["getRichMenuList"] = createLazyFacadeValue(loadFacadeModule, "getRichMenuList");
export const isSenderAllowed: LineRuntimeFacadeModule["isSenderAllowed"] = createLazyFacadeValue(loadFacadeModule, "isSenderAllowed");
export const linkRichMenuToUser: LineRuntimeFacadeModule["linkRichMenuToUser"] = createLazyFacadeValue(loadFacadeModule, "linkRichMenuToUser");
export const linkRichMenuToUsers: LineRuntimeFacadeModule["linkRichMenuToUsers"] = createLazyFacadeValue(loadFacadeModule, "linkRichMenuToUsers");
export const messageAction: LineRuntimeFacadeModule["messageAction"] = createLazyFacadeValue(loadFacadeModule, "messageAction");
export const monitorLineProvider: LineRuntimeFacadeModule["monitorLineProvider"] = createLazyFacadeValue(loadFacadeModule, "monitorLineProvider");
export const normalizeAllowFrom: LineRuntimeFacadeModule["normalizeAllowFrom"] = createLazyFacadeValue(loadFacadeModule, "normalizeAllowFrom");
export const normalizeDmAllowFromWithStore: LineRuntimeFacadeModule["normalizeDmAllowFromWithStore"] = createLazyFacadeValue(loadFacadeModule, "normalizeDmAllowFromWithStore");
export const postbackAction: LineRuntimeFacadeModule["postbackAction"] = createLazyFacadeValue(loadFacadeModule, "postbackAction");
export const probeLineBot: LineRuntimeFacadeModule["probeLineBot"] = createLazyFacadeValue(loadFacadeModule, "probeLineBot");
export const pushFlexMessage: LineRuntimeFacadeModule["pushFlexMessage"] = createLazyFacadeValue(loadFacadeModule, "pushFlexMessage");
export const pushLocationMessage: LineRuntimeFacadeModule["pushLocationMessage"] = createLazyFacadeValue(loadFacadeModule, "pushLocationMessage");
export const pushMessageLine: LineRuntimeFacadeModule["pushMessageLine"] = createLazyFacadeValue(loadFacadeModule, "pushMessageLine");
export const pushMessagesLine: LineRuntimeFacadeModule["pushMessagesLine"] = createLazyFacadeValue(loadFacadeModule, "pushMessagesLine");
export const pushTemplateMessage: LineRuntimeFacadeModule["pushTemplateMessage"] = createLazyFacadeValue(loadFacadeModule, "pushTemplateMessage");
export const pushTextMessageWithQuickReplies: LineRuntimeFacadeModule["pushTextMessageWithQuickReplies"] = createLazyFacadeValue(loadFacadeModule, "pushTextMessageWithQuickReplies");
export const sendMessageLine: LineRuntimeFacadeModule["sendMessageLine"] = createLazyFacadeValue(loadFacadeModule, "sendMessageLine");
export const setDefaultRichMenu: LineRuntimeFacadeModule["setDefaultRichMenu"] = createLazyFacadeValue(loadFacadeModule, "setDefaultRichMenu");
export const toFlexMessage: LineRuntimeFacadeModule["toFlexMessage"] = createLazyFacadeValue(loadFacadeModule, "toFlexMessage");
export const unlinkRichMenuFromUser: LineRuntimeFacadeModule["unlinkRichMenuFromUser"] = createLazyFacadeValue(loadFacadeModule, "unlinkRichMenuFromUser");
export const unlinkRichMenuFromUsers: LineRuntimeFacadeModule["unlinkRichMenuFromUsers"] = createLazyFacadeValue(loadFacadeModule, "unlinkRichMenuFromUsers");
export const uploadRichMenuImage: LineRuntimeFacadeModule["uploadRichMenuImage"] = createLazyFacadeValue(loadFacadeModule, "uploadRichMenuImage");
export const uriAction: LineRuntimeFacadeModule["uriAction"] = createLazyFacadeValue(loadFacadeModule, "uriAction");
