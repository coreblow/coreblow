import { googlechatPlugin } from "./channel.js";

export const googlechatSetupPlugin = {
  id: googlechatPlugin.id,
  meta: googlechatPlugin.meta,
  setup: googlechatPlugin.setup,
  setupWizard: googlechatPlugin.setupWizard,
  capabilities: googlechatPlugin.capabilities,
  streaming: googlechatPlugin.streaming,
  reload: googlechatPlugin.reload,
  config: googlechatPlugin.config,
};
