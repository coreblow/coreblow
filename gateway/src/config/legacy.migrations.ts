/** CoreBlow — Legacy Migrations (barrel) */
import { migrateAudioConfig } from "./legacy.migrations.audio.js";
import { migrateChannelsConfig } from "./legacy.migrations.channels.js";
import { migrateRuntimeConfig } from "./legacy.migrations.runtime.js";
export function runAllLegacyMigrations(config: Record<string, unknown>): Record<string, unknown> { let result = config; result = migrateAudioConfig(result); result = migrateChannelsConfig(result); result = migrateRuntimeConfig(result); return result; }
