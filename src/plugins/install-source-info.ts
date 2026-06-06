import { parseCoreHubPluginSpec } from "../infra/corehub.js";
import { parseRegistryNpmSpec, type ParsedRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import type { PluginPackageInstall } from "./manifest.js";

export type PluginInstallSourceWarning =
  | "invalid-corehub-spec"
  | "invalid-npm-spec"
  | "invalid-default-choice"
  | "default-choice-missing-source"
  | "corehub-spec-floating"
  | "npm-integrity-without-source"
  | "npm-spec-floating"
  | "npm-spec-missing-integrity"
  | "npm-spec-package-name-mismatch";

export type PluginInstallNpmPinState =
  | "exact-with-integrity"
  | "exact-without-integrity"
  | "floating-with-integrity"
  | "floating-without-integrity";

export type PluginInstallNpmSourceInfo = {
  spec: string;
  packageName: string;
  expectedPackageName?: string;
  selector?: string;
  selectorKind: ParsedRegistryNpmSpec["selectorKind"];
  exactVersion: boolean;
  expectedIntegrity?: string;
  pinState: PluginInstallNpmPinState;
};

export type PluginInstallLocalSourceInfo = {
  path: string;
};

export type PluginInstallCoreHubSourceInfo = {
  spec: string;
  packageName: string;
  version?: string;
  exactVersion: boolean;
};

export type PluginInstallSourceInfo = {
  defaultChoice?: PluginPackageInstall["defaultChoice"];
  corehub?: PluginInstallCoreHubSourceInfo;
  npm?: PluginInstallNpmSourceInfo;
  local?: PluginInstallLocalSourceInfo;
  warnings: readonly PluginInstallSourceWarning[];
};

export type DescribePluginInstallSourceOptions = {
  expectedPackageName?: string | null;
};

function resolveNpmPinState(params: {
  exactVersion: boolean;
  hasIntegrity: boolean;
}): PluginInstallNpmPinState {
  if (params.exactVersion) {
    return params.hasIntegrity ? "exact-with-integrity" : "exact-without-integrity";
  }
  return params.hasIntegrity ? "floating-with-integrity" : "floating-without-integrity";
}

function resolveDefaultChoice(value: unknown): PluginPackageInstall["defaultChoice"] | undefined {
  return value === "corehub" || value === "npm" || value === "local" ? value : undefined;
}

function normalizeExpectedPackageName(value: string | null | undefined): string | undefined {
  const expected = normalizeOptionalString(value);
  if (!expected) {
    return undefined;
  }
  return parseRegistryNpmSpec(expected)?.name ?? expected;
}

export function describePluginInstallSource(
  install: PluginPackageInstall,
  options?: DescribePluginInstallSourceOptions,
): PluginInstallSourceInfo {
  const corehubSpec = normalizeOptionalString(install.corehubSpec);
  const npmSpec = normalizeOptionalString(install.npmSpec);
  const localPath = normalizeOptionalString(install.localPath);
  const defaultChoice = resolveDefaultChoice(install.defaultChoice);
  const expectedIntegrity = normalizeOptionalString(install.expectedIntegrity);
  const expectedPackageName = normalizeExpectedPackageName(options?.expectedPackageName);
  const warnings: PluginInstallSourceWarning[] = [];
  let corehub: PluginInstallCoreHubSourceInfo | undefined;
  let npm: PluginInstallNpmSourceInfo | undefined;

  if (install.defaultChoice !== undefined && !defaultChoice) {
    warnings.push("invalid-default-choice");
  }

  if (corehubSpec) {
    const parsed = parseCoreHubPluginSpec(corehubSpec);
    if (parsed) {
      if (!parsed.version) {
        warnings.push("corehub-spec-floating");
      }
      corehub = {
        spec: corehubSpec,
        packageName: parsed.name,
        ...(parsed.version ? { version: parsed.version } : {}),
        exactVersion: Boolean(parsed.version),
      };
    } else {
      warnings.push("invalid-corehub-spec");
    }
  }

  if (npmSpec) {
    const parsed = parseRegistryNpmSpec(npmSpec);
    if (parsed) {
      const exactVersion = parsed.selectorKind === "exact-version";
      const hasIntegrity = Boolean(expectedIntegrity);
      if (!exactVersion) {
        warnings.push("npm-spec-floating");
      }
      if (!hasIntegrity) {
        warnings.push("npm-spec-missing-integrity");
      }
      if (expectedPackageName && parsed.name !== expectedPackageName) {
        warnings.push("npm-spec-package-name-mismatch");
      }
      npm = {
        spec: parsed.raw,
        packageName: parsed.name,
        ...(expectedPackageName && parsed.name !== expectedPackageName
          ? { expectedPackageName }
          : {}),
        selectorKind: parsed.selectorKind,
        exactVersion,
        pinState: resolveNpmPinState({ exactVersion, hasIntegrity }),
        ...(parsed.selector ? { selector: parsed.selector } : {}),
        ...(expectedIntegrity ? { expectedIntegrity } : {}),
      };
    } else {
      warnings.push("invalid-npm-spec");
    }
  }

  if (defaultChoice === "corehub" && !corehub) {
    warnings.push("default-choice-missing-source");
  }
  if (defaultChoice === "npm" && !npm) {
    warnings.push("default-choice-missing-source");
  }
  if (defaultChoice === "local" && !localPath) {
    warnings.push("default-choice-missing-source");
  }
  if (expectedIntegrity && !npm) {
    warnings.push("npm-integrity-without-source");
  }

  return {
    ...(defaultChoice ? { defaultChoice } : {}),
    ...(corehub ? { corehub } : {}),
    ...(npm ? { npm } : {}),
    ...(localPath ? { local: { path: localPath } } : {}),
    warnings,
  };
}
