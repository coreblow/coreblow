// Public security/policy helpers for plugins that need shared trust and DM gating logic.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export * from "../security/channel-metadata.js";
export * from "../security/context-visibility.js";
export * from "../security/dm-policy-shared.js";
export * from "../security/external-content.js";
export * from "../security/safe-regex.js";
export * from "../security/trust-zones.js";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function resolvePathWithinRoot(params: {
  rootDir: string;
  requestedPath: string;
  scopeLabel?: string;
}): { ok: true; path: string } | { ok: false; reason: string } {
  const root = path.resolve(params.rootDir);
  const resolved = path.resolve(root, params.requestedPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { ok: false, reason: `${params.scopeLabel ?? "root"} escape` };
  }
  return { ok: true, path: resolved };
}

export async function replaceFileAtomic(params: {
  filePath: string;
  content: string | Buffer;
  tempPrefix?: string;
}): Promise<void> {
  await fs.mkdir(path.dirname(params.filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(params.filePath),
    `${params.tempPrefix ?? ".coreblow"}-${process.pid}-${Date.now()}.tmp`,
  );
  await fs.writeFile(tempPath, params.content);
  await fs.rename(tempPath, params.filePath);
}

export async function appendRegularFile(
  filePathOrParams:
    | string
    | {
        filePath: string;
        content: string;
        rejectSymlinkParents?: boolean;
      },
  content?: string,
): Promise<void> {
  const filePath = typeof filePathOrParams === "string" ? filePathOrParams : filePathOrParams.filePath;
  const nextContent = typeof filePathOrParams === "string" ? (content ?? "") : filePathOrParams.content;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, nextContent, "utf8");
}

export function safeEqualSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function privateFileStore(rootDir: string): {
  readJsonIfExists: <T>(relativePath: string) => Promise<T | null>;
  writeJson: (
    relativePath: string,
    value: unknown,
    options?: { trailingNewline?: boolean },
  ) => Promise<void>;
} {
  return {
    async readJsonIfExists<T>(relativePath: string) {
      const target = path.join(rootDir, relativePath);
      try {
        return JSON.parse(await fs.readFile(target, "utf8")) as T;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async writeJson(relativePath, value, options = {}) {
      const target = path.join(rootDir, relativePath);
      await replaceFileAtomic({
        filePath: target,
        content: `${JSON.stringify(value, null, 2)}${options.trailingNewline === false ? "" : "\n"}`,
      });
    },
  };
}
