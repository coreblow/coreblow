
import {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./_core-imports.js";
export function hasConfiguredMemorySecretInput(value: unknown): boolean {
  return hasConfiguredSecretInput(value);
}

export function resolveMemorySecretInputString(params: {
  value: unknown;
  path: string;
}): string | undefined {
  return normalizeResolvedSecretInputString({
    value: params.value,
    path: params.path,
  });
}
