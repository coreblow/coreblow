import path from "node:path";
import {
  resolveSafeInstallDir,
  safeDirName,
  safePathSegmentHashed,
  unscopedPackageName,
} from "../infra/install-safe-path.js";
import { resolveConfigDir, resolveUserPath } from "../utils.js";

/**
 * Service class for resolving, encoding, and validating plugin installation paths.
 */
export class PluginInstallPathResolver {
  public static safePluginInstallFileName(input: string): string {
    return safeDirName(input);
  }

  public static encodePluginInstallDirName(pluginId: string): string {
    const trimmed = pluginId.trim();
    if (!trimmed.includes("/")) {
      return safeDirName(trimmed);
    }
    // Scoped plugin ids need a reserved on-disk namespace so they cannot collide
    // with valid unscoped ids that happen to match the hashed slug.
    return `@${safePathSegmentHashed(trimmed)}`;
  }

  public static validatePluginId(pluginId: string): string | null {
    const trimmed = pluginId.trim();
    if (!trimmed) {
      return "invalid plugin name: missing";
    }
    if (trimmed.includes("\\")) {
      return "invalid plugin name: path separators not allowed";
    }
    const segments = trimmed.split("/");
    if (segments.some((segment) => !segment)) {
      return "invalid plugin name: malformed scope";
    }
    if (segments.some((segment) => segment === "." || segment === "..")) {
      return "invalid plugin name: reserved path segment";
    }
    if (segments.length === 1) {
      if (trimmed.startsWith("@")) {
        return "invalid plugin name: scoped ids must use @scope/name format";
      }
      return null;
    }
    if (segments.length !== 2) {
      return "invalid plugin name: path separators not allowed";
    }
    if (!segments[0]?.startsWith("@") || segments[0].length < 2) {
      return "invalid plugin name: scoped ids must use @scope/name format";
    }
    return null;
  }

  public static matchesExpectedPluginId(params: {
    expectedPluginId?: string;
    pluginId: string;
    manifestPluginId?: string;
    npmPluginId: string;
  }): boolean {
    if (!params.expectedPluginId) {
      return true;
    }
    if (params.expectedPluginId === params.pluginId) {
      return true;
    }
    // Backward compatibility: older install records keyed scoped npm packages by
    // their unscoped package name. Preserve update-in-place for those records
    // unless the package declares an explicit manifest id override.
    return (
      !params.manifestPluginId &&
      params.pluginId === params.npmPluginId &&
      params.expectedPluginId === unscopedPackageName(params.npmPluginId)
    );
  }

  public static resolveDefaultPluginExtensionsDir(
    env: NodeJS.ProcessEnv = process.env,
    homedir?: () => string,
  ): string {
    return path.join(resolveConfigDir(env, homedir), "extensions");
  }

  public static resolveDefaultPluginNpmDir(
    env: NodeJS.ProcessEnv = process.env,
    homedir?: () => string,
  ): string {
    return path.join(resolveConfigDir(env, homedir), "npm");
  }

  public static resolveDefaultPluginGitDir(
    env: NodeJS.ProcessEnv = process.env,
    homedir?: () => string,
  ): string {
    return path.join(resolveConfigDir(env, homedir), "git");
  }

  public static resolvePluginInstallDir(pluginId: string, extensionsDir?: string): string {
    const extensionsBase = extensionsDir
      ? resolveUserPath(extensionsDir)
      : PluginInstallPathResolver.resolveDefaultPluginExtensionsDir();
    const pluginIdError = PluginInstallPathResolver.validatePluginId(pluginId);
    if (pluginIdError) {
      throw new Error(pluginIdError);
    }
    const targetDirResult = resolveSafeInstallDir({
      baseDir: extensionsBase,
      id: pluginId,
      invalidNameMessage: "invalid plugin name: path traversal detected",
      nameEncoder: PluginInstallPathResolver.encodePluginInstallDirName,
    });
    if (!targetDirResult.ok) {
      throw new Error(targetDirResult.error);
    }
    return targetDirResult.path;
  }
}

export const safePluginInstallFileName = PluginInstallPathResolver.safePluginInstallFileName;
export const encodePluginInstallDirName = PluginInstallPathResolver.encodePluginInstallDirName;
export const validatePluginId = PluginInstallPathResolver.validatePluginId;
export const matchesExpectedPluginId = PluginInstallPathResolver.matchesExpectedPluginId;
export const resolveDefaultPluginExtensionsDir =
  PluginInstallPathResolver.resolveDefaultPluginExtensionsDir;
export const resolveDefaultPluginNpmDir = PluginInstallPathResolver.resolveDefaultPluginNpmDir;
export const resolveDefaultPluginGitDir = PluginInstallPathResolver.resolveDefaultPluginGitDir;
export const resolvePluginInstallDir = PluginInstallPathResolver.resolvePluginInstallDir;
