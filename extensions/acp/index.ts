import type { CoreBlowPluginApi } from "./runtime-api.js";
import { createAcpPluginConfigSchema } from "./src/config.js";
import { createAcpRuntimeService } from "./src/service.js";

const plugin = {
  id: "acp",
  name: "ACP Runtime",
  description: "ACP runtime backend powered by the acp CLI.",
  configSchema: createAcpPluginConfigSchema(),
  register(api: CoreBlowPluginApi) {
    api.registerService(
      createAcpRuntimeService({
        pluginConfig: api.pluginConfig,
      }),
    );
  },
};

export default plugin;
