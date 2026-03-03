import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import type { AnyAgentTool, CoreBlowPluginApi, CoreBlowPluginToolFactory } from "./runtime-api.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default definePluginEntry({
  id: "lobster",
  name: "Lobster",
  description: "Optional local shell helper tools",
  register(api: CoreBlowPluginApi) {
    api.registerTool(
      ((ctx) => {
        if (ctx.sandboxed) {
          return null;
        }
        return createLobsterTool(api) as AnyAgentTool;
      }) as CoreBlowPluginToolFactory,
      { optional: true },
    );
  },
});
