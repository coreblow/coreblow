import fs from "node:fs";
import { cleanStaleMatrixPluginConfig } from "../commands/doctor/providers/matrix.js";
import type { CoreBlowConfig } from "../config/config.js";
import { loadConfig, readConfigFileSnapshot } from "../config/config.js";
import { installHooksFromNpmSpec, installHooksFromPath } from "../hooks/install.js";
import { resolveArchiveKind } from "../infra/archive.js";
import { parseCoreHubPluginSpec } from "../infra/coreblow-hub.js";
import { extractErrorCode, formatErrorMessage } from "../infra/errors.js";
import { type BundledPluginSource, findBundledPluginSource } from "../plugins/bundled-sources.js";
import { formatCoreHubSpecifier, installPluginFromCoreHub } from "../plugins/coreblow-hub.js";
import { installPluginFromNpmSpec, installPluginFromPath } from "../plugins/install.js";
import { clearPluginManifestRegistryCache } from "../plugins/manifest-registry.js";
import {
  installPluginFromMarketplace,
  resolveMarketplaceInstallShortcut,
} from "../plugins/marketplace.js";
import { defaultRuntime } from "../runtime.js";
import { theme } from "../terminal/theme.js";
import { shortenHomePath } from "../utils.js";
import { looksLikeLocalInstallSpec } from "./install-spec.js";
import { resolvePinnedNpmInstallRecordForCli } from "./npm-resolution.js";
import {
  resolvePluginInstallInvalidConfigPolicy,
  resolvePluginInstallRequestContext,
  type PluginInstallRequestContext,
} from "./plugin-install-config-policy.js";
import {
  resolveBundledInstallPlanBeforeNpm,
  resolveBundledInstallPlanForNpmFailure,
} from "./plugin-install-plan.js";
import {
  buildPreferredCoreHubSpec,
  createHookPackInstallLogger,
  createPluginInstallLogger,
  decidePreferredCoreHubFallback,
  formatPluginInstallWithHookFallbackError,
} from "./plugins-command-helpers.js";
import { persistHookPackInstall, persistPluginInstall } from "./plugins-install-persist.js";

async function installBundledPluginSource(params: {
  config: CoreBlowConfig;
  rawSpec: string;
  bundledSource: BundledPluginSource;
  warning: string;
}) {
  const existing = params.config.plugins?.load?.paths ?? [];
  const mergedPaths = Array.from(new Set([...existing, params.bundledSource.localPath]));
  await persistPluginInstall({
    config: {
      ...params.config,
      plugins: {
        ...params.config.plugins,
        load: {
          ...params.config.plugins?.load,
          paths: mergedPaths,
        },
      },
    },
    pluginId: params.bundledSource.pluginId,
    install: {
      source: "path",
      spec: params.rawSpec,
      sourcePath: params.bundledSource.localPath,
      installPath: params.bundledSource.localPath,
    },
    warningMessage: params.warning,
  });
}

function logPluginInstallDryRun(params: {
  pluginId: string;
  targetDir: string;
  source?: string;
}) {
  const source = params.source ? ` from ${params.source}` : "";
  defaultRuntime.log(
    `Dry run: would install plugin "${params.pluginId}"${source} to ${shortenHomePath(
      params.targetDir,
    )}.`,
  );
}

function logHookInstallDryRun(params: { hookPackId: string; targetDir: string }) {
  defaultRuntime.log(
    `Dry run: would install hook pack "${params.hookPackId}" to ${shortenHomePath(
      params.targetDir,
    )}.`,
  );
}

async function tryInstallHookPackFromLocalPath(params: {
  config: CoreBlowConfig;
  resolvedPath: string;
  link?: boolean;
  dryRun?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (params.link) {
    const stat = fs.statSync(params.resolvedPath);
    if (!stat.isDirectory()) {
      return {
        ok: false,
        error: "Linked hook pack paths must be directories.",
      };
    }

    const probe = await installHooksFromPath({
      path: params.resolvedPath,
      dryRun: true,
    });
    if (!probe.ok) {
      return probe;
    }
    if (params.dryRun) {
      logHookInstallDryRun({
        hookPackId: probe.hookPackId,
        targetDir: params.resolvedPath,
      });
      return { ok: true };
    }

    const existing = params.config.hooks?.internal?.load?.extraDirs ?? [];
    const merged = Array.from(new Set([...existing, params.resolvedPath]));
    await persistHookPackInstall({
      config: {
        ...params.config,
        hooks: {
          ...params.config.hooks,
          internal: {
            ...params.config.hooks?.internal,
            enabled: true,
            load: {
              ...params.config.hooks?.internal?.load,
              extraDirs: merged,
            },
          },
        },
      },
      hookPackId: probe.hookPackId,
      hooks: probe.hooks,
      install: {
        source: "path",
        sourcePath: params.resolvedPath,
        installPath: params.resolvedPath,
        version: probe.version,
      },
      successMessage: `Linked hook pack path: ${shortenHomePath(params.resolvedPath)}`,
    });
    return { ok: true };
  }

  const result = await installHooksFromPath({
    path: params.resolvedPath,
    logger: createHookPackInstallLogger(),
    dryRun: params.dryRun,
  });
  if (!result.ok) {
    return result;
  }
  if (params.dryRun) {
    logHookInstallDryRun({
      hookPackId: result.hookPackId,
      targetDir: result.targetDir,
    });
    return { ok: true };
  }

  const source: "archive" | "path" = resolveArchiveKind(params.resolvedPath) ? "archive" : "path";
  await persistHookPackInstall({
    config: params.config,
    hookPackId: result.hookPackId,
    hooks: result.hooks,
    install: {
      source,
      sourcePath: params.resolvedPath,
      installPath: result.targetDir,
      version: result.version,
    },
  });
  return { ok: true };
}

async function tryInstallHookPackFromNpmSpec(params: {
  config: CoreBlowConfig;
  spec: string;
  pin?: boolean;
  dryRun?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await installHooksFromNpmSpec({
    spec: params.spec,
    logger: createHookPackInstallLogger(),
    dryRun: params.dryRun,
  });
  if (!result.ok) {
    return result;
  }
  if (params.dryRun) {
    logHookInstallDryRun({
      hookPackId: result.hookPackId,
      targetDir: result.targetDir,
    });
    return { ok: true };
  }

  const installRecord = resolvePinnedNpmInstallRecordForCli(
    params.spec,
    Boolean(params.pin),
    result.targetDir,
    result.version,
    result.npmResolution,
    defaultRuntime.log,
    theme.warn,
  );
  await persistHookPackInstall({
    config: params.config,
    hookPackId: result.hookPackId,
    hooks: result.hooks,
    install: installRecord,
  });
  return { ok: true };
}

function isAllowedMatrixRecoveryIssue(issue: { path?: string; message?: string }): boolean {
  return (
    (issue.path === "channels.matrix" && issue.message === "unknown channel id: matrix") ||
    (issue.path === "plugins.load.paths" &&
      typeof issue.message === "string" &&
      issue.message.includes("plugin path not found"))
  );
}

function buildInvalidPluginInstallConfigError(message: string): Error {
  const error = new Error(message);
  (error as { code?: string }).code = "INVALID_CONFIG";
  return error;
}

async function loadConfigFromSnapshotForInstall(
  request: PluginInstallRequestContext,
): Promise<CoreBlowConfig> {
  if (resolvePluginInstallInvalidConfigPolicy(request) !== "recover-matrix-only") {
    throw buildInvalidPluginInstallConfigError(
      "Config invalid; run `coreblow doctor --fix` before installing plugins.",
    );
  }
  const snapshot = await readConfigFileSnapshot();
  const parsed = (snapshot.parsed ?? {}) as Record<string, unknown>;
  if (!snapshot.exists || Object.keys(parsed).length === 0) {
    throw buildInvalidPluginInstallConfigError(
      "Config file could not be parsed; run `coreblow doctor` to repair it.",
    );
  }
  if (
    snapshot.legacyIssues.length > 0 ||
    snapshot.issues.length === 0 ||
    snapshot.issues.some((issue) => !isAllowedMatrixRecoveryIssue(issue))
  ) {
    throw buildInvalidPluginInstallConfigError(
      "Config invalid outside the Matrix upgrade recovery path; run `coreblow doctor --fix` before reinstalling Matrix.",
    );
  }
  const cleaned = await cleanStaleMatrixPluginConfig(snapshot.config);
  return cleaned.config;
}

export async function loadConfigForInstall(
  request: PluginInstallRequestContext,
): Promise<CoreBlowConfig> {
  try {
    return loadConfig();
  } catch (err) {
    if (extractErrorCode(err) !== "INVALID_CONFIG") {
      throw err;
    }
  }
  return loadConfigFromSnapshotForInstall(request);
}

export async function runPluginInstallCommand(params: {
  raw: string;
  opts: { link?: boolean; pin?: boolean; marketplace?: string; dryRun?: boolean };
}) {
  const shorthand = !params.opts.marketplace
    ? await resolveMarketplaceInstallShortcut(params.raw)
    : null;
  if (shorthand?.ok === false) {
    defaultRuntime.error(shorthand.error);
    return defaultRuntime.exit(1);
  }

  const raw = shorthand?.ok ? shorthand.plugin : params.raw;
  const opts = {
    ...params.opts,
    marketplace:
      params.opts.marketplace ?? (shorthand?.ok ? shorthand.marketplaceSource : undefined),
  };
  if (opts.marketplace) {
    if (opts.link) {
      defaultRuntime.error("`--link` is not supported with `--marketplace`.");
      return defaultRuntime.exit(1);
    }
    if (opts.pin) {
      defaultRuntime.error("`--pin` is not supported with `--marketplace`.");
      return defaultRuntime.exit(1);
    }
  }
  const requestResolution = resolvePluginInstallRequestContext({
    rawSpec: raw,
    marketplace: opts.marketplace,
  });
  if (!requestResolution.ok) {
    defaultRuntime.error(requestResolution.error);
    return defaultRuntime.exit(1);
  }
  const request = requestResolution.request;
  const cfg = await loadConfigForInstall(request).catch((error: unknown) => {
    defaultRuntime.error(formatErrorMessage(error));
    return null;
  });
  if (!cfg) {
    return defaultRuntime.exit(1);
  }

  if (opts.marketplace) {
    const result = await installPluginFromMarketplace({
      marketplace: opts.marketplace,
      plugin: raw,
      logger: createPluginInstallLogger(),
      dryRun: opts.dryRun,
    });
    if (!result.ok) {
      defaultRuntime.error(result.error);
      return defaultRuntime.exit(1);
    }
    if (opts.dryRun) {
      logPluginInstallDryRun({
        pluginId: result.pluginId,
        targetDir: result.targetDir,
        source: `marketplace:${result.marketplacePlugin}`,
      });
      return;
    }

    clearPluginManifestRegistryCache();
    await persistPluginInstall({
      config: cfg,
      pluginId: result.pluginId,
      pluginKind: result.kind ?? null,
      install: {
        source: "marketplace",
        installPath: result.targetDir,
        version: result.version,
        marketplaceName: result.marketplaceName,
        marketplaceSource: result.marketplaceSource,
        marketplacePlugin: result.marketplacePlugin,
      },
    });
    return;
  }

  const resolved = request.resolvedPath ?? request.normalizedSpec;

  if (fs.existsSync(resolved)) {
    if (opts.link) {
      const existing = cfg.plugins?.load?.paths ?? [];
      const merged = Array.from(new Set([...existing, resolved]));
      const probe = await installPluginFromPath({ path: resolved, dryRun: true });
      if (!probe.ok) {
        const hookFallback = await tryInstallHookPackFromLocalPath({
          config: cfg,
          resolvedPath: resolved,
          link: true,
          dryRun: opts.dryRun,
        });
        if (hookFallback.ok) {
          return;
        }
        defaultRuntime.error(
          formatPluginInstallWithHookFallbackError(probe.error, hookFallback.error),
        );
        return defaultRuntime.exit(1);
      }
      if (opts.dryRun) {
        logPluginInstallDryRun({
          pluginId: probe.pluginId,
          targetDir: resolved,
        });
        return;
      }

      await persistPluginInstall({
        config: {
          ...cfg,
          plugins: {
            ...cfg.plugins,
            load: {
              ...cfg.plugins?.load,
              paths: merged,
            },
          },
        },
        pluginId: probe.pluginId,
        pluginKind: probe.kind ?? null,
        install: {
          source: "path",
          sourcePath: resolved,
          installPath: resolved,
          version: probe.version,
        },
        successMessage: `Linked plugin path: ${shortenHomePath(resolved)}`,
      });
      return;
    }

    const result = await installPluginFromPath({
      path: resolved,
      logger: createPluginInstallLogger(),
      dryRun: opts.dryRun,
    });
    if (!result.ok) {
      const hookFallback = await tryInstallHookPackFromLocalPath({
        config: cfg,
        resolvedPath: resolved,
        dryRun: opts.dryRun,
      });
      if (hookFallback.ok) {
        return;
      }
      defaultRuntime.error(
        formatPluginInstallWithHookFallbackError(result.error, hookFallback.error),
      );
      return defaultRuntime.exit(1);
    }
    if (opts.dryRun) {
      logPluginInstallDryRun({
        pluginId: result.pluginId,
        targetDir: result.targetDir,
      });
      return;
    }

    clearPluginManifestRegistryCache();
    const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";
    await persistPluginInstall({
      config: cfg,
      pluginId: result.pluginId,
      pluginKind: result.kind ?? null,
      install: {
        source,
        sourcePath: resolved,
        installPath: result.targetDir,
        version: result.version,
      },
    });
    return;
  }

  if (opts.link) {
    defaultRuntime.error("`--link` requires a local path.");
    return defaultRuntime.exit(1);
  }

  if (
    looksLikeLocalInstallSpec(raw, [
      ".ts",
      ".js",
      ".mjs",
      ".cjs",
      ".tgz",
      ".tar.gz",
      ".tar",
      ".zip",
    ])
  ) {
    defaultRuntime.error(`Path not found: ${resolved}`);
    return defaultRuntime.exit(1);
  }

  const bundledPreNpmPlan = resolveBundledInstallPlanBeforeNpm({
    rawSpec: raw,
    findBundledSource: (lookup) => findBundledPluginSource({ lookup }),
  });
  if (bundledPreNpmPlan) {
    if (opts.dryRun) {
      logPluginInstallDryRun({
        pluginId: bundledPreNpmPlan.bundledSource.pluginId,
        targetDir: bundledPreNpmPlan.bundledSource.localPath,
        source: raw,
      });
      return;
    }
    await installBundledPluginSource({
      config: cfg,
      rawSpec: raw,
      bundledSource: bundledPreNpmPlan.bundledSource,
      warning: bundledPreNpmPlan.warning,
    });
    return;
  }

  const corehubSpec = parseCoreHubPluginSpec(raw);
  if (corehubSpec) {
    const result = await installPluginFromCoreHub({
      spec: raw,
      logger: createPluginInstallLogger(),
      dryRun: opts.dryRun,
    });
    if (!result.ok) {
      defaultRuntime.error(result.error);
      return defaultRuntime.exit(1);
    }
    if (opts.dryRun) {
      logPluginInstallDryRun({
        pluginId: result.pluginId,
        targetDir: result.targetDir,
        source: formatCoreHubSpecifier({
          name: result.corehub.corehubPackage,
          version: result.corehub.version,
        }),
      });
      return;
    }

    clearPluginManifestRegistryCache();
    await persistPluginInstall({
      config: cfg,
      pluginId: result.pluginId,
      pluginKind: result.kind ?? null,
      install: {
        source: "corehub",
        spec: formatCoreHubSpecifier({
          name: result.corehub.corehubPackage,
          version: result.corehub.version,
        }),
        installPath: result.targetDir,
        version: result.version,
        integrity: result.corehub.integrity,
        resolvedAt: result.corehub.resolvedAt,
        corehubUrl: result.corehub.corehubUrl,
        corehubPackage: result.corehub.corehubPackage,
        corehubFamily: result.corehub.corehubFamily,
        corehubChannel: result.corehub.corehubChannel,
        artifactSha256: result.corehub.artifactSha256,
        artifactSize: result.corehub.artifactSize,
        artifactManifestVerified: result.corehub.artifactManifestVerified,
        artifactManifestSha256: result.corehub.artifactManifestSha256,
        artifactStorageKey: result.corehub.artifactStorageKey,
        publisherHandle: result.corehub.publisherHandle,
        verifiedAt: result.corehub.verifiedAt,
      },
    });
    return;
  }

  const preferredCoreHubSpec = buildPreferredCoreHubSpec(raw);
  if (preferredCoreHubSpec) {
    const corehubResult = await installPluginFromCoreHub({
      spec: preferredCoreHubSpec,
      logger: createPluginInstallLogger(),
      dryRun: opts.dryRun,
    });
    if (corehubResult.ok) {
      if (opts.dryRun) {
        logPluginInstallDryRun({
          pluginId: corehubResult.pluginId,
          targetDir: corehubResult.targetDir,
          source: formatCoreHubSpecifier({
            name: corehubResult.corehub.corehubPackage,
            version: corehubResult.corehub.version,
          }),
        });
        return;
      }
      clearPluginManifestRegistryCache();
      await persistPluginInstall({
        config: cfg,
        pluginId: corehubResult.pluginId,
        pluginKind: corehubResult.kind ?? null,
        install: {
          source: "corehub",
          spec: formatCoreHubSpecifier({
            name: corehubResult.corehub.corehubPackage,
            version: corehubResult.corehub.version,
          }),
          installPath: corehubResult.targetDir,
          version: corehubResult.version,
          integrity: corehubResult.corehub.integrity,
          resolvedAt: corehubResult.corehub.resolvedAt,
          corehubUrl: corehubResult.corehub.corehubUrl,
          corehubPackage: corehubResult.corehub.corehubPackage,
          corehubFamily: corehubResult.corehub.corehubFamily,
          corehubChannel: corehubResult.corehub.corehubChannel,
          artifactSha256: corehubResult.corehub.artifactSha256,
          artifactSize: corehubResult.corehub.artifactSize,
          artifactManifestVerified: corehubResult.corehub.artifactManifestVerified,
          artifactManifestSha256: corehubResult.corehub.artifactManifestSha256,
          artifactStorageKey: corehubResult.corehub.artifactStorageKey,
          publisherHandle: corehubResult.corehub.publisherHandle,
          verifiedAt: corehubResult.corehub.verifiedAt,
        },
      });
      return;
    }
    if (decidePreferredCoreHubFallback(corehubResult) !== "fallback_to_npm") {
      defaultRuntime.error(corehubResult.error);
      return defaultRuntime.exit(1);
    }
  }

  const result = await installPluginFromNpmSpec({
    spec: raw,
    logger: createPluginInstallLogger(),
    dryRun: opts.dryRun,
  });
  if (!result.ok) {
    const bundledFallbackPlan = resolveBundledInstallPlanForNpmFailure({
      rawSpec: raw,
      code: result.code,
      findBundledSource: (lookup) => findBundledPluginSource({ lookup }),
    });
    if (!bundledFallbackPlan) {
      const hookFallback = await tryInstallHookPackFromNpmSpec({
        config: cfg,
        spec: raw,
        pin: opts.pin,
        dryRun: opts.dryRun,
      });
      if (hookFallback.ok) {
        return;
      }
      defaultRuntime.error(
        formatPluginInstallWithHookFallbackError(result.error, hookFallback.error),
      );
      return defaultRuntime.exit(1);
    }

    if (opts.dryRun) {
      logPluginInstallDryRun({
        pluginId: bundledFallbackPlan.bundledSource.pluginId,
        targetDir: bundledFallbackPlan.bundledSource.localPath,
        source: raw,
      });
      return;
    }
    await installBundledPluginSource({
      config: cfg,
      rawSpec: raw,
      bundledSource: bundledFallbackPlan.bundledSource,
      warning: bundledFallbackPlan.warning,
    });
    return;
  }
  if (opts.dryRun) {
    logPluginInstallDryRun({
      pluginId: result.pluginId,
      targetDir: result.targetDir,
      source: raw,
    });
    return;
  }

  clearPluginManifestRegistryCache();
  const installRecord = resolvePinnedNpmInstallRecordForCli(
    raw,
    Boolean(opts.pin),
    result.targetDir,
    result.version,
    result.npmResolution,
    defaultRuntime.log,
    theme.warn,
  );
  await persistPluginInstall({
    config: cfg,
    pluginId: result.pluginId,
    pluginKind: result.kind ?? null,
    install: installRecord,
  });
}
