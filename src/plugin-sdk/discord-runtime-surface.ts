/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import type { ChannelMessageActionAdapter } from "../channels/plugins/types.js";
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";

type AsyncFn = (...args: unknown[]) => Promise<unknown>;
type SyncFn = (...args: unknown[]) => unknown;

type FacadeModule = {
  addRoleDiscord: AsyncFn;
  auditDiscordChannelPermissions: AsyncFn;
  banMemberDiscord: AsyncFn;
  collectDiscordAuditChannelIds: SyncFn;
  createChannelDiscord: AsyncFn;
  createScheduledEventDiscord: AsyncFn;
  createThreadDiscord: AsyncFn;
  deleteChannelDiscord: AsyncFn;
  deleteMessageDiscord: AsyncFn;
  discordMessageActions: ChannelMessageActionAdapter;
  editChannelDiscord: AsyncFn;
  editDiscordComponentMessage: AsyncFn;
  editMessageDiscord: AsyncFn;
  fetchChannelInfoDiscord: AsyncFn;
  fetchChannelPermissionsDiscord: AsyncFn;
  fetchMemberInfoDiscord: AsyncFn;
  fetchMessageDiscord: AsyncFn;
  fetchReactionsDiscord: AsyncFn;
  fetchRoleInfoDiscord: AsyncFn;
  fetchVoiceStatusDiscord: AsyncFn;
  getGateway: SyncFn;
  getPresence: SyncFn;
  hasAnyGuildPermissionDiscord: SyncFn;
  kickMemberDiscord: AsyncFn;
  listDiscordDirectoryGroupsLive: AsyncFn;
  listDiscordDirectoryPeersLive: AsyncFn;
  listGuildChannelsDiscord: AsyncFn;
  listGuildEmojisDiscord: AsyncFn;
  listPinsDiscord: AsyncFn;
  listScheduledEventsDiscord: AsyncFn;
  listThreadsDiscord: AsyncFn;
  monitorDiscordProvider: AsyncFn;
  moveChannelDiscord: AsyncFn;
  pinMessageDiscord: AsyncFn;
  probeDiscord: AsyncFn;
  reactMessageDiscord: AsyncFn;
  readMessagesDiscord: AsyncFn;
  registerBuiltDiscordComponentMessage: SyncFn;
  removeChannelPermissionDiscord: AsyncFn;
  removeOwnReactionsDiscord: AsyncFn;
  removeReactionDiscord: AsyncFn;
  removeRoleDiscord: AsyncFn;
  resolveDiscordChannelAllowlist: AsyncFn;
  resolveDiscordOutboundSessionRoute: AsyncFn;
  resolveDiscordUserAllowlist: AsyncFn;
  searchMessagesDiscord: AsyncFn;
  sendDiscordComponentMessage: AsyncFn;
  sendMessageDiscord: AsyncFn;
  sendPollDiscord: AsyncFn;
  sendStickerDiscord: AsyncFn;
  sendTypingDiscord: AsyncFn;
  sendVoiceMessageDiscord: AsyncFn;
  setChannelPermissionDiscord: AsyncFn;
  timeoutMemberDiscord: AsyncFn;
  unpinMessageDiscord: AsyncFn;
  uploadEmojiDiscord: AsyncFn;
  uploadStickerDiscord: AsyncFn;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "discord",
    artifactBasename: "runtime-api.js",
  });
}

export const addRoleDiscord: FacadeModule["addRoleDiscord"] = createLazyFacadeValue(loadFacadeModule, "addRoleDiscord");
export const auditDiscordChannelPermissions: FacadeModule["auditDiscordChannelPermissions"] = createLazyFacadeValue(loadFacadeModule, "auditDiscordChannelPermissions");
export const banMemberDiscord: FacadeModule["banMemberDiscord"] = createLazyFacadeValue(loadFacadeModule, "banMemberDiscord");
export const collectDiscordAuditChannelIds: FacadeModule["collectDiscordAuditChannelIds"] = createLazyFacadeValue(loadFacadeModule, "collectDiscordAuditChannelIds");
export const createChannelDiscord: FacadeModule["createChannelDiscord"] = createLazyFacadeValue(loadFacadeModule, "createChannelDiscord");
export const createScheduledEventDiscord: FacadeModule["createScheduledEventDiscord"] = createLazyFacadeValue(loadFacadeModule, "createScheduledEventDiscord");
export const createThreadDiscord: FacadeModule["createThreadDiscord"] = createLazyFacadeValue(loadFacadeModule, "createThreadDiscord");
export const deleteChannelDiscord: FacadeModule["deleteChannelDiscord"] = createLazyFacadeValue(loadFacadeModule, "deleteChannelDiscord");
export const deleteMessageDiscord: FacadeModule["deleteMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "deleteMessageDiscord");
export const discordMessageActions: FacadeModule["discordMessageActions"] = createLazyFacadeObjectValue(() => loadFacadeModule().discordMessageActions);
export const editChannelDiscord: FacadeModule["editChannelDiscord"] = createLazyFacadeValue(loadFacadeModule, "editChannelDiscord");
export const editDiscordComponentMessage: FacadeModule["editDiscordComponentMessage"] = createLazyFacadeValue(loadFacadeModule, "editDiscordComponentMessage");
export const editMessageDiscord: FacadeModule["editMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "editMessageDiscord");
export const fetchChannelInfoDiscord: FacadeModule["fetchChannelInfoDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchChannelInfoDiscord");
export const fetchChannelPermissionsDiscord: FacadeModule["fetchChannelPermissionsDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchChannelPermissionsDiscord");
export const fetchMemberInfoDiscord: FacadeModule["fetchMemberInfoDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchMemberInfoDiscord");
export const fetchMessageDiscord: FacadeModule["fetchMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchMessageDiscord");
export const fetchReactionsDiscord: FacadeModule["fetchReactionsDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchReactionsDiscord");
export const fetchRoleInfoDiscord: FacadeModule["fetchRoleInfoDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchRoleInfoDiscord");
export const fetchVoiceStatusDiscord: FacadeModule["fetchVoiceStatusDiscord"] = createLazyFacadeValue(loadFacadeModule, "fetchVoiceStatusDiscord");
export const getGateway: FacadeModule["getGateway"] = createLazyFacadeValue(loadFacadeModule, "getGateway");
export const getPresence: FacadeModule["getPresence"] = createLazyFacadeValue(loadFacadeModule, "getPresence");
export const hasAnyGuildPermissionDiscord: FacadeModule["hasAnyGuildPermissionDiscord"] = createLazyFacadeValue(loadFacadeModule, "hasAnyGuildPermissionDiscord");
export const kickMemberDiscord: FacadeModule["kickMemberDiscord"] = createLazyFacadeValue(loadFacadeModule, "kickMemberDiscord");
export const listDiscordDirectoryGroupsLive: FacadeModule["listDiscordDirectoryGroupsLive"] = createLazyFacadeValue(loadFacadeModule, "listDiscordDirectoryGroupsLive");
export const listDiscordDirectoryPeersLive: FacadeModule["listDiscordDirectoryPeersLive"] = createLazyFacadeValue(loadFacadeModule, "listDiscordDirectoryPeersLive");
export const listGuildChannelsDiscord: FacadeModule["listGuildChannelsDiscord"] = createLazyFacadeValue(loadFacadeModule, "listGuildChannelsDiscord");
export const listGuildEmojisDiscord: FacadeModule["listGuildEmojisDiscord"] = createLazyFacadeValue(loadFacadeModule, "listGuildEmojisDiscord");
export const listPinsDiscord: FacadeModule["listPinsDiscord"] = createLazyFacadeValue(loadFacadeModule, "listPinsDiscord");
export const listScheduledEventsDiscord: FacadeModule["listScheduledEventsDiscord"] = createLazyFacadeValue(loadFacadeModule, "listScheduledEventsDiscord");
export const listThreadsDiscord: FacadeModule["listThreadsDiscord"] = createLazyFacadeValue(loadFacadeModule, "listThreadsDiscord");
export const monitorDiscordProvider: FacadeModule["monitorDiscordProvider"] = createLazyFacadeValue(loadFacadeModule, "monitorDiscordProvider");
export const moveChannelDiscord: FacadeModule["moveChannelDiscord"] = createLazyFacadeValue(loadFacadeModule, "moveChannelDiscord");
export const pinMessageDiscord: FacadeModule["pinMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "pinMessageDiscord");
export const probeDiscord: FacadeModule["probeDiscord"] = createLazyFacadeValue(loadFacadeModule, "probeDiscord");
export const reactMessageDiscord: FacadeModule["reactMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "reactMessageDiscord");
export const readMessagesDiscord: FacadeModule["readMessagesDiscord"] = createLazyFacadeValue(loadFacadeModule, "readMessagesDiscord");
export const registerBuiltDiscordComponentMessage: FacadeModule["registerBuiltDiscordComponentMessage"] = createLazyFacadeValue(loadFacadeModule, "registerBuiltDiscordComponentMessage");
export const removeChannelPermissionDiscord: FacadeModule["removeChannelPermissionDiscord"] = createLazyFacadeValue(loadFacadeModule, "removeChannelPermissionDiscord");
export const removeOwnReactionsDiscord: FacadeModule["removeOwnReactionsDiscord"] = createLazyFacadeValue(loadFacadeModule, "removeOwnReactionsDiscord");
export const removeReactionDiscord: FacadeModule["removeReactionDiscord"] = createLazyFacadeValue(loadFacadeModule, "removeReactionDiscord");
export const removeRoleDiscord: FacadeModule["removeRoleDiscord"] = createLazyFacadeValue(loadFacadeModule, "removeRoleDiscord");
export const resolveDiscordChannelAllowlist: FacadeModule["resolveDiscordChannelAllowlist"] = createLazyFacadeValue(loadFacadeModule, "resolveDiscordChannelAllowlist");
export const resolveDiscordOutboundSessionRoute: FacadeModule["resolveDiscordOutboundSessionRoute"] = createLazyFacadeValue(loadFacadeModule, "resolveDiscordOutboundSessionRoute");
export const resolveDiscordUserAllowlist: FacadeModule["resolveDiscordUserAllowlist"] = createLazyFacadeValue(loadFacadeModule, "resolveDiscordUserAllowlist");
export const searchMessagesDiscord: FacadeModule["searchMessagesDiscord"] = createLazyFacadeValue(loadFacadeModule, "searchMessagesDiscord");
export const sendDiscordComponentMessage: FacadeModule["sendDiscordComponentMessage"] = createLazyFacadeValue(loadFacadeModule, "sendDiscordComponentMessage");
export const sendMessageDiscord: FacadeModule["sendMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "sendMessageDiscord");
export const sendPollDiscord: FacadeModule["sendPollDiscord"] = createLazyFacadeValue(loadFacadeModule, "sendPollDiscord");
export const sendStickerDiscord: FacadeModule["sendStickerDiscord"] = createLazyFacadeValue(loadFacadeModule, "sendStickerDiscord");
export const sendTypingDiscord: FacadeModule["sendTypingDiscord"] = createLazyFacadeValue(loadFacadeModule, "sendTypingDiscord");
export const sendVoiceMessageDiscord: FacadeModule["sendVoiceMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "sendVoiceMessageDiscord");
export const setChannelPermissionDiscord: FacadeModule["setChannelPermissionDiscord"] = createLazyFacadeValue(loadFacadeModule, "setChannelPermissionDiscord");
export const timeoutMemberDiscord: FacadeModule["timeoutMemberDiscord"] = createLazyFacadeValue(loadFacadeModule, "timeoutMemberDiscord");
export const unpinMessageDiscord: FacadeModule["unpinMessageDiscord"] = createLazyFacadeValue(loadFacadeModule, "unpinMessageDiscord");
export const uploadEmojiDiscord: FacadeModule["uploadEmojiDiscord"] = createLazyFacadeValue(loadFacadeModule, "uploadEmojiDiscord");
export const uploadStickerDiscord: FacadeModule["uploadStickerDiscord"] = createLazyFacadeValue(loadFacadeModule, "uploadStickerDiscord");
