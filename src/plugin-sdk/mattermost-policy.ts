import { createLazyFacadeValue, loadBundledPluginPublicSurfaceModuleSync } from "./facade-runtime.js";

type FacadeModule = {
  isMattermostSenderAllowed: (params: {
    senderId: string;
    senderName?: string | null;
    allowFrom: ReadonlyArray<string | number>;
    allowNameMatching?: boolean;
  }) => boolean;
};

function loadFacadeModule(): FacadeModule {
  return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
    dirName: "mattermost",
    artifactBasename: "api.js",
  });
}

export const isMattermostSenderAllowed: FacadeModule["isMattermostSenderAllowed"] =
  createLazyFacadeValue(loadFacadeModule, "isMattermostSenderAllowed");
