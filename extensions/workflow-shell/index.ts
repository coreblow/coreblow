import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import type { AnyAgentTool, CoreBlowPluginApi, CoreBlowPluginToolFactory } from "./runtime-api.js";
import { createWorkflowShellTool } from "./src/workflow-shell-tool.js";

export default definePluginEntry({
  id: "workflow-shell",
  name: "Workflow Shell",
  description: "Optional local shell helper tools",
  register(api: CoreBlowPluginApi) {
    api.registerTool(
      ((ctx) => {
        if (ctx.sandboxed) {
          return null;
        }
        return createWorkflowShellTool(api) as AnyAgentTool;
      }) as CoreBlowPluginToolFactory,
      { optional: true },
    );
  },
});
