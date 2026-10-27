import type { ModelCatalogProvider } from "../types.js";

export type CoreBlowProviderIndexPluginInstall = {
  corehubSpec?: string;
  clawhubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "corehub" | "clawhub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type CoreBlowProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: CoreBlowProviderIndexPluginInstall;
};

export type CoreBlowProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type CoreBlowProviderIndexProvider = {
  id: string;
  name: string;
  plugin: CoreBlowProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly CoreBlowProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type CoreBlowProviderIndex = {
  version: number;
  providers: Readonly<Record<string, CoreBlowProviderIndexProvider>>;
};
