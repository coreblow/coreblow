/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";
import type {
  CardAction,
  FlexContainer,
  LineChannelData,
  LineConfig,
  LineProbeResult,
  LineRuntimeFacadeModule,
  ListItem,
  ResolvedLineAccount,
} from "./line.types.js";

export type {
  CardAction,
  FlexContainer,
  LineChannelData,
  LineConfig,
  LineProbeResult,
  ListItem,
  ResolvedLineAccount,
};

function loadFacadeModule(): LineRuntimeFacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<LineRuntimeFacadeModule>({
    dirName: "line",
    artifactBasename: "runtime-api.js",
  });
}

export const createActionCard: LineRuntimeFacadeModule["createActionCard"] = createLazyFacadeValue(loadFacadeModule, "createActionCard");
export const createAgendaCard: LineRuntimeFacadeModule["createAgendaCard"] = createLazyFacadeValue(loadFacadeModule, "createAgendaCard");
export const createAppleTvRemoteCard: LineRuntimeFacadeModule["createAppleTvRemoteCard"] = createLazyFacadeValue(loadFacadeModule, "createAppleTvRemoteCard");
export const createDeviceControlCard: LineRuntimeFacadeModule["createDeviceControlCard"] = createLazyFacadeValue(loadFacadeModule, "createDeviceControlCard");
export const createEventCard: LineRuntimeFacadeModule["createEventCard"] = createLazyFacadeValue(loadFacadeModule, "createEventCard");
export const createImageCard: LineRuntimeFacadeModule["createImageCard"] = createLazyFacadeValue(loadFacadeModule, "createImageCard");
export const createInfoCard: LineRuntimeFacadeModule["createInfoCard"] = createLazyFacadeValue(loadFacadeModule, "createInfoCard");
export const createListCard: LineRuntimeFacadeModule["createListCard"] = createLazyFacadeValue(loadFacadeModule, "createListCard");
export const createMediaPlayerCard: LineRuntimeFacadeModule["createMediaPlayerCard"] = createLazyFacadeValue(loadFacadeModule, "createMediaPlayerCard");
export const createReceiptCard: LineRuntimeFacadeModule["createReceiptCard"] = createLazyFacadeValue(loadFacadeModule, "createReceiptCard");
export const LineConfigSchema: LineRuntimeFacadeModule["LineConfigSchema"] = createLazyFacadeObjectValue(() => loadFacadeModule().LineConfigSchema);
export const listLineAccountIds: LineRuntimeFacadeModule["listLineAccountIds"] = createLazyFacadeValue(loadFacadeModule, "listLineAccountIds");
export const normalizeAccountId: LineRuntimeFacadeModule["normalizeAccountId"] = createLazyFacadeValue(loadFacadeModule, "normalizeAccountId");
export const processLineMessage: LineRuntimeFacadeModule["processLineMessage"] = createLazyFacadeValue(loadFacadeModule, "processLineMessage");
export const resolveDefaultLineAccountId: LineRuntimeFacadeModule["resolveDefaultLineAccountId"] = createLazyFacadeValue(loadFacadeModule, "resolveDefaultLineAccountId");
export const resolveExactLineGroupConfigKey: LineRuntimeFacadeModule["resolveExactLineGroupConfigKey"] = createLazyFacadeValue(loadFacadeModule, "resolveExactLineGroupConfigKey");
export const resolveLineAccount: LineRuntimeFacadeModule["resolveLineAccount"] = createLazyFacadeValue(loadFacadeModule, "resolveLineAccount");
