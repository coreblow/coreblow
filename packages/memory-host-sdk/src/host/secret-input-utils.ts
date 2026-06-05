import {
  hasConfiguredSecretInput as hasConfiguredCoreSecretInput,
  normalizeResolvedSecretInputString as normalizeResolvedCoreSecretInputString,
} from "./_core-imports.js";

export type InputRefSource = "env" | "file" | "exec";

export type InputRef = {
  source: InputRefSource;
  provider: string;
  id: string;
};

export function hasConfiguredSecretInput(value: unknown): boolean {
  return hasConfiguredCoreSecretInput(value);
}

export function normalizeResolvedSecretInputString(params: {
  value: unknown;
  path: string;
}): string | undefined {
  return normalizeResolvedCoreSecretInputString(params);
}

export function normalizeEnvSecretInputString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
