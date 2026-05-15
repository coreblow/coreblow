import path from "node:path";

export const unitTestIncludePatterns = [
  "src/**/*.test.ts",
];

export const unitTestAdditionalExcludePatterns = [
  "src/gateway/**",
  "extensions/**",
  "src/browser/**",
  "src/line/**",
  "src/agents/**",
  "src/auto-reply/**",
  "src/commands/**",
  "src/channels/plugins/contracts/**",
  "src/plugins/contracts/**",
];

const sharedBaseExcludePatterns = [
  "dist/**",
  "apps/macos/**",
  "apps/macos/.build/**",
  "**/node_modules/**",
  "**/vendor/**",
  "dist/CoreBlow.app/**",
  "**/*.live.test.ts",
  "**/*.e2e.test.ts",
];

const normalizeRepoPath = (value) => value.split(path.sep).join("/");

const matchesAny = (file, patterns) => patterns.some((pattern) => path.matchesGlob(file, pattern));

export function isUnitConfigTestFile(file) {
  const normalizedFile = normalizeRepoPath(file);
  return (
    matchesAny(normalizedFile, unitTestIncludePatterns) &&
    !matchesAny(normalizedFile, sharedBaseExcludePatterns) &&
    !matchesAny(normalizedFile, unitTestAdditionalExcludePatterns)
  );
}
