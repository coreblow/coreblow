import type { CoreBlowConfig } from "../config/config.js";
import type { PluginPackageInstall } from "../plugins/manifest.js";
import type { RuntimeEnv } from "../runtime.js";
import { t } from "./i18n/index.js";
import type { WizardPrompter } from "./prompts.js";

const SKIP_VALUE = "__skip__";

export type OfficialPluginOnboardingInstallEntry = {
  pluginId: string;
  label: string;
  description?: string;
  install: PluginPackageInstall;
  trustedSourceLinkedOfficialInstall?: boolean;
};

function formatInstallHint(install: PluginPackageInstall): string {
  if (install.corehubSpec && install.npmSpec) {
    return install.defaultChoice === "corehub"
      ? "CoreHub, with npm fallback"
      : "npm, with CoreHub fallback";
  }
  if (install.corehubSpec) {
    return "CoreHub";
  }
  if (install.npmSpec) {
    return "npm";
  }
  if (install.localPath) {
    return "local path";
  }
  return "install source";
}

export const testing = {
  formatInstallHint,
};

export function resolveOfficialPluginOnboardingInstallEntries(_params: {
  config: CoreBlowConfig;
}): OfficialPluginOnboardingInstallEntry[] {
  return [];
}

export async function setupOfficialPluginInstalls(params: {
  config: CoreBlowConfig;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  workspaceDir?: string;
}): Promise<CoreBlowConfig> {
  const installEntries = resolveOfficialPluginOnboardingInstallEntries({
    config: params.config,
  });
  if (installEntries.length === 0) {
    return params.config;
  }

  await params.prompter.multiselect({
    message: t("wizard.plugins.officialInstall"),
    options: [
      {
        value: SKIP_VALUE,
        label: t("common.skipForNow"),
        hint: t("wizard.plugins.officialSkipHint"),
      },
      ...installEntries.map((entry) => ({
        value: entry.pluginId,
        label: entry.label,
        hint: entry.description ?? formatInstallHint(entry.install),
      })),
    ],
  });
  return params.config;
}

export { testing as __testing };
