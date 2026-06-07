import { legacyConfigRules, normalizeCompatibilityConfig } from "./doctor-contract.js";

type ChannelDoctorAdapter = {
  dmAllowFromMode: string;
  groupModel: string;
  groupAllowFromFallbackToAllowFrom: boolean;
  warnOnEmptyGroupSenderAllowlist: boolean;
  legacyConfigRules: typeof legacyConfigRules;
  normalizeCompatibilityConfig: typeof normalizeCompatibilityConfig;
};

export const zalouserDoctor: ChannelDoctorAdapter = {
  dmAllowFromMode: "topOnly",
  groupModel: "hybrid",
  groupAllowFromFallbackToAllowFrom: false,
  warnOnEmptyGroupSenderAllowlist: false,
  legacyConfigRules,
  normalizeCompatibilityConfig,
};
