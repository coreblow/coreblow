import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BUNDLED_RUNTIME_SIDECAR_PATHS } from "../plugins/runtime-sidecar-paths.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { pathExists } from "../utils.js";
import {
  applyNpmFreshnessBypassEnv,
  applyPosixNpmScriptShellEnv,
  createNpmFreshnessBypassArgs,
} from "./npm-install-env.js";
import {
  collectPackageDistInventory,
  PACKAGE_DIST_INVENTORY_RELATIVE_PATH,
  readPackageDistInventoryIfPresent,
} from "./package-dist-inventory.js";
import { readPackageVersion } from "./package-json.js";
import { applyPathPrepend } from "./path-prepend.js";
import { parseSemver } from "./runtime-guard.js";

export type GlobalInstallManager = "npm" | "pnpm" | "bun";

export type CommandRunner = (
  argv: string[],
  options: { timeoutMs: number; cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string; code: number | null }>;

type ResolvedGlobalInstallCommand = {
  manager: GlobalInstallManager;
  command: string;
};

export type ResolvedGlobalInstallTarget = ResolvedGlobalInstallCommand & {
  globalRoot: string | null;
  packageRoot: string | null;
  directNodeModulesRoot?: boolean;
};

const PRIMARY_PACKAGE_NAME = "coreblow";
const ALL_PACKAGE_NAMES = ["coreblow", "openclaw"] as const;
const GLOBAL_RENAME_PREFIX = ".";
export const COREBLOW_MAIN_PACKAGE_SPEC = "github:coreblow/coreblow#main";
export const OPENCLAW_MAIN_PACKAGE_SPEC = COREBLOW_MAIN_PACKAGE_SPEC;
const COREPACK_ENABLE_DOWNLOAD_PROMPT_DEFAULT = "0";
const NPM_GLOBAL_INSTALL_QUIET_FLAGS = ["--no-fund", "--no-audit", "--loglevel=error"] as const;
const PNPM_COREBLOW_BUILD_ALLOWLIST_FLAG = `--allow-build=${PRIMARY_PACKAGE_NAME}`;
const FIRST_PACKAGED_DIST_INVENTORY_VERSION = { major: 2026, minor: 4, patch: 15 };
const OMITTED_PRIVATE_QA_BUNDLED_PLUGIN_ROOTS = new Set([
  "dist/extensions/qa-channel",
  "dist/extensions/qa-lab",
  "dist/extensions/qa-matrix",
]);

export type NpmGlobalPrefixLayout = {
  prefix: string;
  globalRoot: string;
  binDir: string;
};

function normalizePackageTarget(value: string): string {
  return value.trim();
}

function normalizePackageVersionForComparison(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^[vV](?=\d)/, "");
}

export function isMainPackageTarget(value: string): boolean {
  return normalizeLowercaseStringOrEmpty(normalizePackageTarget(value)) === "main";
}

export function isExplicitPackageInstallSpec(value: string): boolean {
  const trimmed = normalizePackageTarget(value);
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.includes("://") ||
    trimmed.includes("#") ||
    /^(?:file|github|git\+ssh|git\+https|git\+http|git\+file|npm):/i.test(trimmed)
  );
}

function stripPrimaryPackageAlias(spec: string): string {
  const normalized = normalizePackageTarget(spec);
  for (const name of ALL_PACKAGE_NAMES) {
    const prefix = `${name}@`;
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }
  return normalized;
}

function isPnpmCoreBlowSourceInstallSpec(spec: string): boolean {
  const target = stripPrimaryPackageAlias(spec);
  return (
    /^github:/i.test(target) ||
    /^git\+(?:ssh|https|http|file):/i.test(target) ||
    /^git:/i.test(target)
  );
}

export function resolveExpectedInstalledVersionFromSpec(
  packageName: string,
  spec: string,
): string | null {
  const normalizedPackageName = packageName.trim();
  const normalizedSpec = normalizePackageTarget(spec);
  if (!normalizedPackageName || !normalizedSpec.startsWith(`${normalizedPackageName}@`)) {
    return null;
  }
  const rawVersion = normalizedSpec.slice(normalizedPackageName.length + 1).trim();
  if (
    !rawVersion ||
    rawVersion.includes("/") ||
    rawVersion.includes(":") ||
    rawVersion.includes("#") ||
    /^(latest|beta|next|main)$/i.test(rawVersion)
  ) {
    return null;
  }
  return normalizePackageVersionForComparison(rawVersion);
}

export async function collectInstalledGlobalPackageErrors(params: {
  packageRoot: string;
  expectedVersion?: string | null;
}): Promise<string[]> {
  const errors: string[] = [];
  errors.push(...(await collectSourceCheckoutInstallErrors(params.packageRoot)));
  const installedVersion = await readPackageVersion(params.packageRoot);
  const expectedComparable = normalizePackageVersionForComparison(params.expectedVersion);
  const installedComparable = normalizePackageVersionForComparison(installedVersion);
  if (expectedComparable && installedComparable !== expectedComparable) {
    errors.push(
      `expected installed version ${expectedComparable}, found ${installedComparable ?? "<missing>"}`,
    );
  }
  errors.push(
    ...(await collectPostInventoryVerificationErrors({
      packageRoot: params.packageRoot,
      installedVersion,
    })),
  );
  return errors;
}

async function collectSourceCheckoutInstallErrors(packageRoot: string): Promise<string[]> {
  const gitDir = path.join(packageRoot, ".git");
  if (!(await pathExists(gitDir))) {
    return [];
  }
  return [
    `detected source checkout at ${packageRoot}; git-based checkouts must be updated with git pull`,
  ];
}

async function collectPostInventoryVerificationErrors(params: {
  packageRoot: string;
  installedVersion?: string | null;
}): Promise<string[]> {
  const errors: string[] = [];
  const inventory = await readPackageDistInventoryIfPresent(params.packageRoot);
  if (inventory) {
    const presentFiles = new Set(await collectPackageDistInventory(params.packageRoot));
    for (const relativePath of inventory) {
      if (!presentFiles.has(relativePath)) {
        errors.push(`missing packaged dist file ${relativePath}`);
      }
    }
    return errors;
  }

  const parsedVersion = parseSemver(params.installedVersion ?? "");
  const requiresInventory =
    Boolean(parsedVersion) &&
    (parsedVersion!.major > FIRST_PACKAGED_DIST_INVENTORY_VERSION.major ||
      (parsedVersion!.major === FIRST_PACKAGED_DIST_INVENTORY_VERSION.major &&
        parsedVersion!.minor > FIRST_PACKAGED_DIST_INVENTORY_VERSION.minor) ||
      (parsedVersion!.major === FIRST_PACKAGED_DIST_INVENTORY_VERSION.major &&
        parsedVersion!.minor === FIRST_PACKAGED_DIST_INVENTORY_VERSION.minor &&
        parsedVersion!.patch >= FIRST_PACKAGED_DIST_INVENTORY_VERSION.patch));

  if (requiresInventory) {
    errors.push(`missing package dist inventory ${PACKAGE_DIST_INVENTORY_RELATIVE_PATH}`);
  }

  for (const relativePath of BUNDLED_RUNTIME_SIDECAR_PATHS) {
    if (
      Array.from(OMITTED_PRIVATE_QA_BUNDLED_PLUGIN_ROOTS).some((root) =>
        relativePath.startsWith(root),
      )
    ) {
      continue;
    }
    const fullPath = path.join(params.packageRoot, relativePath);
    if (!(await pathExists(fullPath))) {
      errors.push(`missing bundled plugin runtime artifact ${relativePath}`);
    }
  }
  return errors;
}

export function canResolveRegistryVersionForPackageTarget(value: string): boolean {
  return !isMainPackageTarget(value) && !isExplicitPackageInstallSpec(value);
}

export function resolveGlobalInstallSpec(params: {
  packageName: string;
  tag?: string;
  target?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = params.env ?? process.env;
  const envOverride =
    env.COREBLOW_UPDATE_PACKAGE_SPEC?.trim() ||
    env.OPENCLAW_UPDATE_PACKAGE_SPEC?.trim();
  if (envOverride) {
    return envOverride;
  }

  const rawTarget = params.target?.trim() ?? "";
  if (rawTarget) {
    if (isMainPackageTarget(rawTarget)) {
      return COREBLOW_MAIN_PACKAGE_SPEC;
    }
    if (isExplicitPackageInstallSpec(rawTarget)) {
      return rawTarget;
    }
    return `${params.packageName}@${rawTarget}`;
  }

  const tag = params.tag?.trim() || "latest";
  if (isMainPackageTarget(tag)) {
    return COREBLOW_MAIN_PACKAGE_SPEC;
  }
  return `${params.packageName}@${tag}`;
}

export async function createGlobalInstallEnv(
  options: {
    env?: NodeJS.ProcessEnv;
    packageManager?: GlobalInstallManager;
  } = {},
): Promise<NodeJS.ProcessEnv> {
  const base = { ...(options.env ?? process.env) };
  delete base.COREBLOW_UPDATE_PACKAGE_SPEC;
  delete base.OPENCLAW_UPDATE_PACKAGE_SPEC;
  base.COREPACK_ENABLE_DOWNLOAD_PROMPT ??= COREPACK_ENABLE_DOWNLOAD_PROMPT_DEFAULT;
  applyPosixNpmScriptShellEnv(base);
  applyNpmFreshnessBypassEnv(base);
  return base;
}

async function tryRealpath(targetPath: string): Promise<string> {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return targetPath;
  }
}

export async function resolveGlobalRoot(
  manager: GlobalInstallManager,
  runCommand: CommandRunner,
  timeoutMs: number,
): Promise<string | null> {
  if (manager === "bun") {
    return resolveBunGlobalRoot();
  }
  const argv = [manager, "root", "-g"];
  const res = await runCommand(argv, { timeoutMs }).catch(() => null);
  if (!res || res.code !== 0) {
    return null;
  }
  const root = res.stdout.trim();
  return root || null;
}

export function resolveBunGlobalRoot(): string {
  return path.join(os.homedir(), ".bun", "install", "global", "node_modules");
}

export async function resolveGlobalPackageRoot(
  manager: GlobalInstallManager,
  runCommand: CommandRunner,
  timeoutMs: number,
): Promise<string | null> {
  const root = await resolveGlobalRoot(manager, runCommand, timeoutMs);
  if (!root) {
    return null;
  }
  for (const name of ALL_PACKAGE_NAMES) {
    const candidate = path.join(root, name);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return path.join(root, PRIMARY_PACKAGE_NAME);
}

export function resolveNpmGlobalPrefixLayoutFromGlobalRoot(
  globalRoot: string | null,
  options?: { allowDirectNodeModulesRoot?: boolean },
): NpmGlobalPrefixLayout | null {
  const trimmed = globalRoot?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = path.resolve(trimmed);
  if (path.basename(normalized) !== "node_modules") {
    return null;
  }
  const parentDir = path.dirname(normalized);
  if (path.basename(parentDir) === "lib") {
    const prefix = path.dirname(parentDir);
    return {
      prefix,
      globalRoot: normalized,
      binDir: path.join(prefix, "bin"),
    };
  }
  if (process.platform === "win32") {
    return {
      prefix: parentDir,
      globalRoot: normalized,
      binDir: parentDir,
    };
  }
  if (options?.allowDirectNodeModulesRoot) {
    return {
      prefix: parentDir,
      globalRoot: normalized,
      binDir: path.join(parentDir, "bin"),
    };
  }
  return null;
}

export function resolveNpmGlobalPrefixLayoutFromPrefix(prefix: string): NpmGlobalPrefixLayout {
  const normalizedPrefix = path.resolve(prefix);
  if (process.platform === "win32") {
    return {
      prefix: normalizedPrefix,
      globalRoot: path.join(normalizedPrefix, "node_modules"),
      binDir: normalizedPrefix,
    };
  }
  return {
    prefix: normalizedPrefix,
    globalRoot: path.join(normalizedPrefix, "lib", "node_modules"),
    binDir: path.join(normalizedPrefix, "bin"),
  };
}

export function resolvePnpmGlobalDirFromGlobalRoot(globalRoot: string | null): string | null {
  const trimmed = globalRoot?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = path.resolve(trimmed);
  if (path.basename(normalized) !== "node_modules") {
    return null;
  }
  const globalDir = path.dirname(normalized);
  return globalDir || null;
}

function resolvePreferredNpmCommand(pkgRoot: string | null | undefined): string | null {
  const trimmed = pkgRoot?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = path.resolve(trimmed);
  const parts = normalized.split(path.sep);
  const nvmIndex = parts.lastIndexOf(".nvm");
  if (nvmIndex >= 0 && parts[nvmIndex + 1] === "versions" && parts[nvmIndex + 2] === "node") {
    const nodeVersionDir = parts.slice(0, nvmIndex + 4).join(path.sep);
    const candidate = path.join(nodeVersionDir, "bin", "npm");
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeGlobalInstallCommand(
  managerOrCommand: GlobalInstallManager | ResolvedGlobalInstallCommand,
  pkgRoot?: string | null,
): ResolvedGlobalInstallCommand {
  if (typeof managerOrCommand === "object" && managerOrCommand !== null) {
    return managerOrCommand;
  }
  if (managerOrCommand === "npm") {
    const preferredNpm = resolvePreferredNpmCommand(pkgRoot);
    if (preferredNpm) {
      return { manager: "npm", command: preferredNpm };
    }
  }
  return { manager: managerOrCommand, command: managerOrCommand };
}

async function isPnpmGlobalPackageRoot(pkgRoot: string): Promise<boolean> {
  const normalized = path.resolve(pkgRoot);
  const parent = path.dirname(normalized);
  if (path.basename(parent) !== "node_modules") {
    return false;
  }
  const grandParent = path.dirname(parent);
  if (path.basename(grandParent) === "global_bin") {
    return true;
  }
  return pathExists(path.join(grandParent, "pnpm-lock.yaml"));
}

export function resolveGlobalInstallCommand(params: {
  manager: GlobalInstallManager;
  packageRoot?: string | null;
}): ResolvedGlobalInstallCommand {
  return normalizeGlobalInstallCommand(params.manager, params.packageRoot);
}

export async function resolveGlobalInstallTarget(params: {
  manager: GlobalInstallManager | ResolvedGlobalInstallCommand;
  packageRoot?: string | null;
  runCommand: CommandRunner;
  timeoutMs: number;
}): Promise<ResolvedGlobalInstallTarget> {
  const command = normalizeGlobalInstallCommand(params.manager, params.packageRoot);
  const detectedRoot = await resolveGlobalRoot(command.manager, params.runCommand, params.timeoutMs);
  let honoredPackageRootGlobalRoot: string | null = null;
  let honoredDirectNpmRoot = false;

  if (params.packageRoot) {
    const normalizedPkg = path.resolve(params.packageRoot);
    if (path.basename(normalizedPkg) === PRIMARY_PACKAGE_NAME || ALL_PACKAGE_NAMES.includes(path.basename(normalizedPkg) as any)) {
      const parent = path.dirname(normalizedPkg);
      if (path.basename(parent) === "node_modules") {
        honoredPackageRootGlobalRoot = parent;
        if (
          command.manager === "npm" &&
          resolveNpmGlobalPrefixLayoutFromGlobalRoot(parent) === null &&
          resolveNpmGlobalPrefixLayoutFromGlobalRoot(parent, {
            allowDirectNodeModulesRoot: true,
          }) !== null
        ) {
          honoredDirectNpmRoot = true;
        }
      }
    }
  }

  const targetGlobalRoot = honoredPackageRootGlobalRoot ?? detectedRoot;
  return {
    ...command,
    globalRoot: targetGlobalRoot,
    packageRoot: targetGlobalRoot ? path.join(targetGlobalRoot, PRIMARY_PACKAGE_NAME) : null,
    ...(honoredPackageRootGlobalRoot &&
    targetGlobalRoot === honoredPackageRootGlobalRoot &&
    honoredDirectNpmRoot
      ? { directNodeModulesRoot: true }
      : {}),
  };
}

export async function detectGlobalInstallManagerForRoot(
  runCommand: CommandRunner,
  pkgRoot: string,
  timeoutMs: number,
): Promise<GlobalInstallManager | null> {
  const pkgReal = await tryRealpath(pkgRoot);

  const candidates: Array<{
    manager: "npm" | "pnpm";
    argv: string[];
  }> = [
    { manager: "npm", argv: ["npm", "root", "-g"] },
    { manager: "pnpm", argv: ["pnpm", "root", "-g"] },
  ];

  for (const { manager, argv } of candidates) {
    const res = await runCommand(argv, { timeoutMs }).catch(() => null);
    if (!res || res.code !== 0) {
      continue;
    }
    const globalRoot = res.stdout.trim();
    if (!globalRoot) {
      continue;
    }
    const globalReal = await tryRealpath(globalRoot);
    for (const name of ALL_PACKAGE_NAMES) {
      const expected = path.join(globalReal, name);
      const expectedReal = await tryRealpath(expected);
      if (path.resolve(expectedReal) === path.resolve(pkgReal)) {
        return manager;
      }
    }
  }

  if (await isPnpmGlobalPackageRoot(pkgRoot)) {
    return "pnpm";
  }

  const bunGlobalRoot = resolveBunGlobalRoot();
  const bunGlobalReal = await tryRealpath(bunGlobalRoot);
  for (const name of ALL_PACKAGE_NAMES) {
    const bunExpected = path.join(bunGlobalReal, name);
    const bunExpectedReal = await tryRealpath(bunExpected);
    if (path.resolve(bunExpectedReal) === path.resolve(pkgReal)) {
      return "bun";
    }
  }

  if (resolvePreferredNpmCommand(pkgRoot)) {
    return "npm";
  }

  return null;
}

export async function detectGlobalInstallManagerByPresence(
  runCommand: CommandRunner,
  timeoutMs: number,
): Promise<GlobalInstallManager | null> {
  for (const manager of ["npm", "pnpm"] as const) {
    const root = await resolveGlobalRoot(manager, runCommand, timeoutMs);
    if (!root) {
      continue;
    }
    for (const name of ALL_PACKAGE_NAMES) {
      if (await pathExists(path.join(root, name))) {
        return manager;
      }
    }
  }

  const bunRoot = resolveBunGlobalRoot();
  for (const name of ALL_PACKAGE_NAMES) {
    if (await pathExists(path.join(bunRoot, name))) {
      return "bun";
    }
  }
  return null;
}

export function globalInstallArgs(
  managerOrCommand: GlobalInstallManager | ResolvedGlobalInstallCommand,
  spec: string,
  pkgRoot?: string | null,
  installPrefix?: string | null,
): string[] {
  const resolved = normalizeGlobalInstallCommand(managerOrCommand, pkgRoot);
  if (resolved.manager === "pnpm") {
    return [
      resolved.command,
      "add",
      "-g",
      ...(installPrefix ? ["--global-dir", installPrefix] : []),
      ...(isPnpmCoreBlowSourceInstallSpec(spec) ? [PNPM_COREBLOW_BUILD_ALLOWLIST_FLAG] : []),
      spec,
    ];
  }
  if (resolved.manager === "bun") {
    return [resolved.command, "add", "-g", spec];
  }
  return [
    resolved.command,
    "i",
    "-g",
    ...(installPrefix ? ["--prefix", installPrefix] : []),
    spec,
    ...NPM_GLOBAL_INSTALL_QUIET_FLAGS,
    ...createNpmFreshnessBypassArgs(),
  ];
}

export function globalInstallFallbackArgs(
  managerOrCommand: GlobalInstallManager | ResolvedGlobalInstallCommand,
  spec: string,
  pkgRoot?: string | null,
  installPrefix?: string | null,
): string[] | null {
  const resolved = normalizeGlobalInstallCommand(managerOrCommand, pkgRoot);
  if (resolved.manager !== "npm") {
    return null;
  }
  return [
    resolved.command,
    "i",
    "-g",
    ...(installPrefix ? ["--prefix", installPrefix] : []),
    spec,
    "--omit=optional",
    ...NPM_GLOBAL_INSTALL_QUIET_FLAGS,
    ...createNpmFreshnessBypassArgs(),
  ];
}

export async function cleanupGlobalRenameDirs(params: {
  globalRoot: string;
  packageName: string;
}): Promise<{ removed: string[] }> {
  const removed: string[] = [];
  const root = params.globalRoot.trim();
  const name = params.packageName.trim();
  if (!root || !name) {
    return { removed };
  }
  const prefix = `${GLOBAL_RENAME_PREFIX}${name}-`;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return { removed };
  }
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const target = path.join(root, entry);
    try {
      const stat = await fs.lstat(target);
      if (!stat.isDirectory()) {
        continue;
      }
      await fs.rm(target, { recursive: true, force: true });
      removed.push(entry);
    } catch {
      // ignore cleanup failures
    }
  }
  return { removed };
}

// ---------------------------------------------------------------------------
// UpdateGlobalService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class UpdateGlobalService {
  [Symbol.toStringTag] = 'UpdateGlobalService';
}

const { getInstance: getUpdateGlobalService, __testing: __testing_updateGlobal } =
  createStandaloneSingleton({ create: () => new UpdateGlobalService(), defaultDeps: {} });

export { getUpdateGlobalService, __testing_updateGlobal };
