import type { LegacyConfigMigrationSpec } from "../../../config/legacy.shared.js";
import { LEGACY_CONFIG_MIGRATIONS_RUNTIME } from "./legacy-config-migrations.runtime.js";

// PLACEHOLDER: import remaining migration arrays as they are ported
// import { LEGACY_CONFIG_MIGRATIONS_AUDIO } from "./legacy-config-migrations.audio.js";
// import { LEGACY_CONFIG_MIGRATIONS_CHANNELS } from "./legacy-config-migrations.channels.js";
// import { LEGACY_CONFIG_MIGRATIONS_QUEUE } from "./legacy-config-migrations.queue.js";
// import { LEGACY_CONFIG_MIGRATIONS_WEB_SEARCH } from "./legacy-config-migrations.web-search.js";

const LEGACY_CONFIG_MIGRATION_SPECS: LegacyConfigMigrationSpec[] = [
  ...LEGACY_CONFIG_MIGRATIONS_RUNTIME,
];

export const LEGACY_CONFIG_MIGRATIONS = LEGACY_CONFIG_MIGRATION_SPECS.map(
  ({ legacyRules: _legacyRules, ...migration }) => migration,
);

export const LEGACY_CONFIG_MIGRATION_RULES = LEGACY_CONFIG_MIGRATION_SPECS.flatMap(
  (migration) => migration.legacyRules ?? [],
);
