/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
import {
  createLazyFacadeObjectValue,
  createLazyFacadeValue,
  loadBundledPluginPublicSurfaceModuleSync,
} from "./facade-runtime.js";

type FacadeModule = {
  buildFeishuConversationId: (...args: unknown[]) => string;
  createFeishuThreadBindingManager: (params: Record<string, unknown>) => {
    stop: () => void;
    [key: string]: unknown;
  };
  feishuThreadBindingTesting: Record<string, unknown>;
  parseFeishuDirectConversationId: (...args: unknown[]) => unknown;
  parseFeishuConversationId: (...args: unknown[]) => unknown;
  parseFeishuTargetId: (...args: unknown[]) => unknown;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "feishu",
    artifactBasename: "api.js",
  });
}

export const buildFeishuConversationId: FacadeModule["buildFeishuConversationId"] =
  createLazyFacadeValue(loadFacadeModule, "buildFeishuConversationId");
export const createFeishuThreadBindingManager: FacadeModule["createFeishuThreadBindingManager"] =
  createLazyFacadeValue(loadFacadeModule, "createFeishuThreadBindingManager");
export const feishuSessionBindingAdapterChannels = ["feishu"] as const;
export const feishuThreadBindingTesting: FacadeModule["feishuThreadBindingTesting"] =
  createLazyFacadeObjectValue(() => loadFacadeModule().feishuThreadBindingTesting);
export const parseFeishuDirectConversationId: FacadeModule["parseFeishuDirectConversationId"] =
  createLazyFacadeValue(loadFacadeModule, "parseFeishuDirectConversationId");
export const parseFeishuConversationId: FacadeModule["parseFeishuConversationId"] =
  createLazyFacadeValue(loadFacadeModule, "parseFeishuConversationId");
export const parseFeishuTargetId: FacadeModule["parseFeishuTargetId"] = createLazyFacadeValue(
  loadFacadeModule,
  "parseFeishuTargetId",
);
