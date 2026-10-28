import type { TSchema } from "typebox";
import type { CoreBlowConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  RuntimeWebFetchMetadata,
  RuntimeWebSearchMetadata,
} from "../secrets/runtime-web-tools.types.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import type { SecretInputMode } from "./provider-auth-types.js";

export type WebSearchProviderId = string;
export type WebFetchProviderId = string;

export type WebSearchProviderToolDefinition = {
  description: string;
  parameters: TSchema;
  execute: (
    args: Record<string, unknown>,
    context?: WebSearchProviderToolExecutionContext,
  ) => Promise<Record<string, unknown>>;
};

export type WebFetchProviderToolDefinition = {
  description: string;
  parameters: TSchema;
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export type WebSearchProviderContext = {
  config?: CoreBlowConfig;
  searchConfig?: Record<string, unknown>;
  runtimeMetadata?: RuntimeWebSearchMetadata;
};

export type WebSearchProviderToolExecutionContext = {
  signal?: AbortSignal;
};

export type WebFetchProviderContext = {
  config?: CoreBlowConfig;
  fetchConfig?: Record<string, unknown>;
  runtimeMetadata?: RuntimeWebFetchMetadata;
};

export type WebSearchCredentialResolutionSource = "config" | "secretRef" | "env" | "missing";

export type WebSearchProviderConfiguredCredentialFallback = {
  path: string;
  value: unknown;
};

export type WebFetchProviderConfiguredCredentialFallback = {
  path: string;
  value: unknown;
};

export type WebSearchRuntimeMetadataContext = {
  config?: CoreBlowConfig;
  searchConfig?: Record<string, unknown>;
  runtimeMetadata?: RuntimeWebSearchMetadata;
  resolvedCredential?: {
    value?: string;
    source: WebSearchCredentialResolutionSource;
    fallbackEnvVar?: string;
  };
};

export type WebSearchProviderSetupContext = {
  config: CoreBlowConfig;
  runtime: RuntimeEnv;
  prompter: WizardPrompter;
  quickstartDefaults?: boolean;
  secretInputMode?: SecretInputMode;
};

export type WebFetchCredentialResolutionSource = "config" | "secretRef" | "env" | "missing";

export type WebFetchRuntimeMetadataContext = {
  config?: CoreBlowConfig;
  fetchConfig?: Record<string, unknown>;
  runtimeMetadata?: RuntimeWebFetchMetadata;
  resolvedCredential?: {
    value?: string;
    source: WebFetchCredentialResolutionSource;
    fallbackEnvVar?: string;
  };
};

export type WebSearchProviderPlugin = {
  id: WebSearchProviderId;
  label: string;
  hint: string;
  onboardingScopes?: readonly "text-inference"[];
  requiresCredential?: boolean;
  credentialLabel?: string;
  envVars: string[];
  placeholder: string;
  signupUrl: string;
  docsUrl?: string;
  /** Optional note shown before credential collection for provider-specific prerequisites. */
  credentialNote?: string;
  autoDetectOrder?: number;
  credentialPath: string;
  inactiveSecretPaths?: string[];
  getCredentialValue: (searchConfig?: Record<string, unknown>) => unknown;
  setCredentialValue: (searchConfigTarget: Record<string, unknown>, value: unknown) => void;
  getConfiguredCredentialValue?: (config?: CoreBlowConfig) => unknown;
  setConfiguredCredentialValue?: (configTarget: CoreBlowConfig, value: unknown) => void;
  getConfiguredCredentialFallback?: (
    config?: CoreBlowConfig,
  ) => WebSearchProviderConfiguredCredentialFallback | undefined;
  applySelectionConfig?: (config: CoreBlowConfig) => CoreBlowConfig;
  runSetup?: (ctx: WebSearchProviderSetupContext) => CoreBlowConfig | Promise<CoreBlowConfig>;
  resolveRuntimeMetadata?: (
    ctx: WebSearchRuntimeMetadataContext,
  ) => Partial<RuntimeWebSearchMetadata> | Promise<Partial<RuntimeWebSearchMetadata>>;
  createTool: (ctx: WebSearchProviderContext) => WebSearchProviderToolDefinition | null;
};

export type PluginWebSearchProviderEntry = WebSearchProviderPlugin & {
  pluginId: string;
};

export type WebFetchProviderPlugin = {
  id: WebFetchProviderId;
  label: string;
  hint: string;
  requiresCredential?: boolean;
  credentialLabel?: string;
  envVars: string[];
  placeholder: string;
  signupUrl: string;
  docsUrl?: string;
  autoDetectOrder?: number;
  credentialPath: string;
  inactiveSecretPaths?: string[];
  getCredentialValue: (fetchConfig?: Record<string, unknown>) => unknown;
  setCredentialValue: (fetchConfigTarget: Record<string, unknown>, value: unknown) => void;
  getConfiguredCredentialValue?: (config?: CoreBlowConfig) => unknown;
  setConfiguredCredentialValue?: (configTarget: CoreBlowConfig, value: unknown) => void;
  getConfiguredCredentialFallback?: (
    config?: CoreBlowConfig,
  ) => WebFetchProviderConfiguredCredentialFallback | undefined;
  applySelectionConfig?: (config: CoreBlowConfig) => CoreBlowConfig;
  resolveRuntimeMetadata?: (
    ctx: WebFetchRuntimeMetadataContext,
  ) => Partial<RuntimeWebFetchMetadata> | Promise<Partial<RuntimeWebFetchMetadata>>;
  createTool: (ctx: WebFetchProviderContext) => WebFetchProviderToolDefinition | null;
};

export type PluginWebFetchProviderEntry = WebFetchProviderPlugin & {
  pluginId: string;
};
