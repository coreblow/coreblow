import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { buildClaudeMigrationProvider } from "./provider.js";

export default definePluginEntry({
  id: "migrate-claude",
  name: "Claude Migration",
  description: "Imports Claude state into CoreBlow.",
  register(api) {
    const provider = buildClaudeMigrationProvider({ runtime: api.runtime });
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
      id: "migrate-claude",
      start() {},
    });
  },
});
