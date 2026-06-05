import { definePluginEntry } from "./plugin-entry.js";

export function defineBundledChannelEntry(params: {
  id: string;
  name: string;
  description: string;
  importMetaUrl?: string;
  plugin?: unknown;
  runtime?: unknown;
}) {
  return definePluginEntry({
    id: params.id,
    name: params.name,
    description: params.description,
    register(api) {
      api.registerService({
        id: params.id,
        start() {},
      });
    },
  });
}
