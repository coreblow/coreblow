import { isDeepStrictEqual } from "node:util";
import { isPlainObject } from "../infra/plain-object.js";
import { applyMergePatch } from "./merge-patch.js";
import type { CoreBlowConfig } from "./types.js";

const MANAGED_CONFIG_UNSET_PATHS = [["plugins", "installs"]] as const;

function cloneUnknown<T>(value: T): T {
  return structuredClone(value);
}

export function createMergePatch(base: unknown, target: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(target)) {
    return cloneUnknown(target);
  }

  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  for (const key of keys) {
    const hasBase = Object.hasOwn(base, key);
    const hasTarget = Object.hasOwn(target, key);
    if (!hasTarget) {
      patch[key] = null;
      continue;
    }
    const targetValue = target[key];
    if (!hasBase) {
      patch[key] = cloneUnknown(targetValue);
      continue;
    }
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(targetValue)) {
      const childPatch = createMergePatch(baseValue, targetValue);
      if (isPlainObject(childPatch) && Object.keys(childPatch).length === 0) {
        continue;
      }
      patch[key] = childPatch;
      continue;
    }
    if (!isDeepStrictEqual(baseValue, targetValue)) {
      patch[key] = cloneUnknown(targetValue);
    }
  }
  return patch;
}

export function projectSourceOntoRuntimeShape(source: unknown, runtime: unknown): unknown {
  if (!isPlainObject(source) || !isPlainObject(runtime)) {
    return cloneUnknown(source);
  }

  const next: Record<string, unknown> = {};
  for (const [key, sourceValue] of Object.entries(source)) {
    if (!(key in runtime)) {
      next[key] = cloneUnknown(sourceValue);
      continue;
    }
    next[key] = projectSourceOntoRuntimeShape(sourceValue, runtime[key]);
  }
  return next;
}

function isNumericPathSegment(segment: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(segment);
}

function getPathValue(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      if (!isNumericPathSegment(segment)) {
        return undefined;
      }
      current = current[Number.parseInt(segment, 10)];
      continue;
    }
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function deletePathValue(value: unknown, path: readonly string[]): unknown {
  if (path.length === 0 || !isPlainObject(value)) {
    return value;
  }
  const [head, ...tail] = path;
  if (!Object.hasOwn(value, head)) {
    return value;
  }
  const next: Record<string, unknown> = { ...value };
  if (tail.length === 0) {
    delete next[head];
    return next;
  }
  next[head] = deletePathValue(value[head], tail);
  return next;
}

export function unsetPathForWrite(config: unknown, path: readonly string[]): unknown {
  return deletePathValue(config, path);
}

export function applyUnsetPathsForWrite(
  config: unknown,
  unsetPaths: readonly (readonly string[])[] = MANAGED_CONFIG_UNSET_PATHS,
): unknown {
  return unsetPaths.reduce((next, path) => unsetPathForWrite(next, path), config);
}

export function collectChangedPaths(
  base: unknown,
  target: unknown,
  path = "",
  output: Set<string> = new Set<string>(),
): Set<string> {
  if (Array.isArray(base) && Array.isArray(target)) {
    const max = Math.max(base.length, target.length);
    for (let index = 0; index < max; index += 1) {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      if (index >= base.length || index >= target.length) {
        output.add(childPath);
        continue;
      }
      collectChangedPaths(base[index], target[index], childPath, output);
    }
    return output;
  }
  if (isPlainObject(base) && isPlainObject(target)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(base, key) || !Object.hasOwn(target, key)) {
        output.add(childPath);
        continue;
      }
      collectChangedPaths(base[key], target[key], childPath, output);
    }
    return output;
  }
  if (!isDeepStrictEqual(base, target)) {
    output.add(path);
  }
  return output;
}

function parentPath(value: string): string {
  if (!value) {
    return "";
  }
  const bracket = value.lastIndexOf("[");
  const dot = value.lastIndexOf(".");
  const index = Math.max(bracket, dot);
  return index <= 0 ? "" : value.slice(0, index);
}

export function resolveWriteEnvSnapshotForPath(
  changedPaths: Set<string> | null | undefined,
  envRefMap: Map<string, string> | null | undefined,
): Map<string, string> | null {
  if (!changedPaths || !envRefMap || envRefMap.size === 0) {
    return null;
  }
  const snapshot = new Map<string, string>();
  for (const [path, value] of envRefMap) {
    if (changedPaths.has(path) || changedPaths.has(parentPath(path))) {
      snapshot.set(path, value);
    }
  }
  return snapshot.size > 0 ? snapshot : null;
}

export function restoreEnvRefsFromMap(
  value: unknown,
  path: string,
  envRefMap: Map<string, string>,
  changedPaths: Set<string> | null = null,
): unknown {
  if (envRefMap.has(path) && !changedPaths?.has(path)) {
    return envRefMap.get(path);
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item, index) => {
      const updated = restoreEnvRefsFromMap(item, `${path}[${index}]`, envRefMap, changedPaths);
      changed ||= updated !== item;
      return updated;
    });
    return changed ? next : value;
  }
  if (isPlainObject(value)) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const updated = restoreEnvRefsFromMap(child, childPath, envRefMap, changedPaths);
      changed ||= updated !== child;
      next[key] = updated;
    }
    return changed ? next : value;
  }
  return value;
}

export function resolvePersistCandidateForWrite(params: {
  runtimeConfig: CoreBlowConfig;
  sourceConfig: CoreBlowConfig;
  nextConfig: CoreBlowConfig;
  unsetPaths?: readonly (readonly string[])[];
}): CoreBlowConfig {
  const patch = createMergePatch(params.runtimeConfig, params.nextConfig);
  const projectedSource = projectSourceOntoRuntimeShape(params.sourceConfig, params.runtimeConfig);
  const candidate = applyMergePatch(projectedSource, patch);
  return applyUnsetPathsForWrite(candidate, params.unsetPaths) as CoreBlowConfig;
}

export function formatConfigValidationFailure(issues: Array<{ path: string; message: string }>): string {
  return issues.map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`).join("\n");
}
