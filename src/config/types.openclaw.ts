import type {
  ConfigFileSnapshot as CoreBlowConfigFileSnapshot,
  ConfigValidationIssue,
  CoreBlowConfig,
  LegacyConfigIssue,
} from "./types.coreblow.js";

export type OpenClawConfig = CoreBlowConfig;

declare const openClawConfigStateBrand: unique symbol;

type BrandedConfigState<TState extends string> = CoreBlowConfig & {
  readonly [openClawConfigStateBrand]?: TState;
};

export type SourceConfig = BrandedConfigState<"source">;
export type ResolvedSourceConfig = BrandedConfigState<"resolved-source">;
export type RuntimeConfig = BrandedConfigState<"runtime">;

export type { ConfigValidationIssue, CoreBlowConfig, LegacyConfigIssue };

export type ConfigFileSnapshot = Omit<
  CoreBlowConfigFileSnapshot,
  "resolved" | "config"
> & {
  sourceConfig: ResolvedSourceConfig;
  resolved: ResolvedSourceConfig;
  runtimeConfig: RuntimeConfig;
  /** @deprecated Prefer runtimeConfig. */
  config: RuntimeConfig;
};
