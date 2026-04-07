/**
 * src/infra/windows-install-roots.ts
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SYSTEM_ROOT = "C:\\Windows";
const DEFAULT_PROGRAM_FILES = "C:\\Program Files";
const DEFAULT_PROGRAM_FILES_X86 = "C:\\Program Files (x86)";

export type WindowsInstallRoots = {
  systemRoot: string;
  programFiles: string;
  programFilesX86: string;
  programW6432: string | null;
};

// Simplified mock because deep registry checks are overcomplicated for daemon focus.
export function getWindowsInstallRoots(
  env: Record<string, string | undefined> = process.env,
): WindowsInstallRoots {
  return {
    systemRoot: env.SystemRoot || env.WINDIR || DEFAULT_SYSTEM_ROOT,
    programFiles: env.ProgramFiles || DEFAULT_PROGRAM_FILES,
    programFilesX86: env["ProgramFiles(x86)"] || DEFAULT_PROGRAM_FILES_X86,
    programW6432: env.ProgramW6432 || null,
  };
}

export function getWindowsProgramFilesRoots(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const roots = getWindowsInstallRoots(env);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of [roots.programW6432, roots.programFiles, roots.programFilesX86]) {
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}
