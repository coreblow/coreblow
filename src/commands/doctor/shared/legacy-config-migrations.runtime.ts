import type { LegacyConfigMigrationSpec } from "../../../config/legacy.shared.js";
import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_DIAGNOSTICS } from "./legacy-config-migrations.runtime.diagnostics.js";
import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_SESSION } from "./legacy-config-migrations.runtime.session.js";

// PLACEHOLDER: import remaining runtime migration arrays as they are ported
// import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_AGENTS } from "./legacy-config-migrations.runtime.agents.js";
// import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_GATEWAY } from "./legacy-config-migrations.runtime.gateway.js";
// import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_MCP } from "./legacy-config-migrations.runtime.mcp.js";
// import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_PROVIDERS } from "./legacy-config-migrations.runtime.providers.js";
// import { LEGACY_CONFIG_MIGRATIONS_RUNTIME_TTS } from "./legacy-config-migrations.runtime.tts.js";

export const LEGACY_CONFIG_MIGRATIONS_RUNTIME: LegacyConfigMigrationSpec[] = [
  ...LEGACY_CONFIG_MIGRATIONS_RUNTIME_DIAGNOSTICS,
  ...LEGACY_CONFIG_MIGRATIONS_RUNTIME_SESSION,
];
