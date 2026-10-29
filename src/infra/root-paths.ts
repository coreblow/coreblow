import "./fs-safe-defaults.js";
import fs from "node:fs/promises";
import path from "node:path";

export type ResolvePathWithinRootParams = {
  rootDir: string;
  requestedPath: string;
  scopeLabel: string;
  defaultFileName?: string;
};

export type ResolvePathsResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export type ResolveMultiPathsResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

export function resolvePathWithinRoot(params: ResolvePathWithinRootParams): ResolvePathsResult {
  const root = path.resolve(params.rootDir);
  const raw = params.requestedPath.trim();
  if (!raw) {
    if (!params.defaultFileName) {
      return { ok: false, error: "path is required" };
    }
    return { ok: true, path: path.join(root, params.defaultFileName) };
  }
  const resolved = path.resolve(root, raw);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: `Invalid path: must stay within ${params.scopeLabel}` };
  }
  return { ok: true, path: resolved };
}

export async function resolveWritablePathWithinRoot(
  params: ResolvePathWithinRootParams,
): Promise<ResolvePathsResult> {
  const lexical = resolvePathWithinRoot(params);
  if (!lexical.ok) {
    return lexical;
  }
  const root = path.resolve(params.rootDir);
  try {
    const parent = path.dirname(lexical.path);
    const parentStat = await fs.stat(parent).catch(() => null);
    if (parentStat && !parentStat.isDirectory()) {
      return { ok: false, error: `Invalid path: must stay within ${params.scopeLabel}` };
    }
  } catch {
    // If parent doesn't exist, it can be created
  }
  return lexical;
}

export function resolvePathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): ResolveMultiPathsResult {
  const paths: string[] = [];
  for (const raw of params.requestedPaths) {
    const res = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    paths.push(res.path);
  }
  return { ok: true, paths };
}

export async function resolveExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<ResolveMultiPathsResult> {
  const paths: string[] = [];
  for (const raw of params.requestedPaths) {
    const res = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    paths.push(res.path);
  }
  return { ok: true, paths };
}

export async function resolveStrictExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<ResolveMultiPathsResult> {
  const paths: string[] = [];
  for (const raw of params.requestedPaths) {
    const res = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    try {
      const stat = await fs.stat(res.path);
      if (!stat.isFile()) {
        return {
          ok: false,
          error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
        };
      }
      paths.push(res.path);
    } catch {
      return {
        ok: false,
        error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
      };
    }
  }
  return { ok: true, paths };
}

export async function ensureDirectoryWithinRoot(params: {
  rootDir: string;
  requestedPath: string;
  scopeLabel: string;
  defaultDirName?: string;
  mode?: number;
}): Promise<ResolvePathsResult> {
  const lexical = resolvePathWithinRoot({
    rootDir: params.rootDir,
    requestedPath: params.requestedPath,
    scopeLabel: params.scopeLabel,
    defaultFileName: params.defaultDirName,
  });
  if (!lexical.ok) {
    return lexical;
  }
  await fs.mkdir(lexical.path, { recursive: true, mode: params.mode ?? 0o700 });
  return lexical;
}

export function pathScope(
  rootDir: string,
  options: { label: string },
) {
  const base = { rootDir, scopeLabel: options.label };
  return {
    rootDir,
    label: options.label,
    resolve: (requestedPath: string, pathOptions?: { defaultName?: string }) =>
      resolvePathWithinRoot({
        ...base,
        requestedPath,
        defaultFileName: pathOptions?.defaultName,
      }),
    resolveAll: (requestedPaths: string[]) =>
      resolvePathsWithinRoot({
        ...base,
        requestedPaths,
      }),
    existing: (requestedPaths: string[]) =>
      resolveExistingPathsWithinRoot({
        ...base,
        requestedPaths,
      }),
    files: (requestedPaths: string[]) =>
      resolveStrictExistingPathsWithinRoot({
        ...base,
        requestedPaths,
      }),
    writable: (requestedPath: string, pathOptions?: { defaultName?: string }) =>
      resolveWritablePathWithinRoot({
        ...base,
        requestedPath,
        defaultFileName: pathOptions?.defaultName,
      }),
    ensureDir: (requestedPath: string, pathOptions?: { defaultName?: string; mode?: number }) =>
      ensureDirectoryWithinRoot({
        ...base,
        requestedPath,
        defaultDirName: pathOptions?.defaultName,
        mode: pathOptions?.mode,
      }),
  };
}
