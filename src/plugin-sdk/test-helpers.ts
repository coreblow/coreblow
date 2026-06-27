import { mkdirSync, type RmOptions } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";

/**
 * Focused public test helper for plugin-sdk test suites that need a
 * shared, auto-cleaned temp-directory root across an entire test file.
 *
 * Each call to `createTempDir`/`createTempDirSync` returns a fresh
 * directory nested under a per-file fixture root created in
 * `beforeAll` and removed in `afterAll`.
 */
export function createPluginSdkTestHarness(options?: { cleanup?: RmOptions }) {
  let fixtureRoot = "";
  let caseId = 0;

  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), "coreblow-plugin-sdk-fixtures-"));
  });

  afterAll(async () => {
    if (!fixtureRoot) {
      return;
    }
    await rm(fixtureRoot, {
      recursive: true,
      force: true,
      ...options?.cleanup,
    });
  });

  function nextTempDir(prefix: string): string {
    return path.join(fixtureRoot, `${prefix}${caseId++}`);
  }

  async function createTempDir(prefix: string): Promise<string> {
    const dir = nextTempDir(prefix);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  function createTempDirSync(prefix: string): string {
    const dir = nextTempDir(prefix);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  return {
    createTempDir,
    createTempDirSync,
  };
}
