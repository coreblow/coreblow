import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { buildHermesMigrationProvider } from "./provider.js";

export default definePluginEntry({
  id: "migrate-hermes",
  name: "Hermes Migration",
  description: "Imports Hermes state into CoreBlow.",
  register(api) {
    const provider = buildHermesMigrationProvider({ runtime: api.runtime });
    const registerMigrationProvider = (
      api as typeof api & {
        registerMigrationProvider?: (migrationProvider: unknown) => void;
      }
    ).registerMigrationProvider;
    if (registerMigrationProvider) {
      registerMigrationProvider(provider);
      return;
    }
    api.registerService({
      id: "migrate-hermes",
      start() {},
    });
  },
});
