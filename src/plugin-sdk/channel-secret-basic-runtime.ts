// Narrow shared secret-contract exports for non-TTS channel/plugin secret surfaces.

export {
  collectConditionalChannelFieldAssignments,
  collectNestedChannelFieldAssignments,
  collectSimpleChannelFieldAssignments,
  getChannelRecord,
  getChannelSurface,
  hasConfiguredSecretInputValue,
  isBaseFieldActiveForChannelSurface,
  normalizeSecretStringValue,
  resolveChannelAccountSurface,
} from "../secrets/runtime-config-collectors-channels.js";
export type {
  ChannelAccountEntry,
  ChannelAccountPredicate,
  ChannelAccountSurface,
} from "../secrets/runtime-config-collectors-channels.js";
export {
  collectSecretInputAssignment,
  hasOwnProperty,
  isEnabledFlag,
} from "../secrets/runtime-shared.js";
export type { ResolverContext, SecretDefaults } from "../secrets/runtime-shared.js";
export { isRecord } from "../secrets/shared.js";
export type { SecretTargetRegistryEntry } from "../secrets/target-registry-types.js";
