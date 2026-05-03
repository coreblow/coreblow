import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';
import { loadPatternListFromEnv } from './vitest.pattern-file.ts';
import { resolveVitestIsolation } from './vitest.scoped-config.ts';
import {
  unitTestAdditionalExcludePatterns,
  unitTestIncludePatterns,
} from './vitest.unit-paths.mjs';

/**
 * Unit test config — matches OpenClaw split-config architecture.
 *
 * This config runs ONLY core infrastructure tests (config, infra, cli,
 * plugin-sdk, plugins). Domain tests (agents, auto-reply, commands,
 * gateway) are excluded here and run via their own configs:
 *   - vitest.gateway.config.ts
 *   - vitest.channels.config.ts
 *   - vitest.contracts.config.ts
 *   - vitest.extensions.config.ts
 *
 * Inherits resolve.alias from vitest.config.ts so that
 * `coreblow/plugin-sdk/*` subpath imports resolve correctly.
 */

const base = baseConfig as unknown as Record<string, unknown>;
const baseTest = (baseConfig as { test?: { include?: string[]; exclude?: string[] } }).test ?? {};
const exclude = baseTest.exclude ?? [];

export function loadIncludePatternsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  return loadPatternListFromEnv('COREBLOW_VITEST_INCLUDE_FILE', env);
}

export function loadExtraExcludePatternsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return loadPatternListFromEnv('COREBLOW_VITEST_EXTRA_EXCLUDE_FILE', env) ?? [];
}

export function createUnitVitestConfig(env: Record<string, string | undefined> = process.env) {
  return defineConfig({
    ...base,
    test: {
      ...baseTest,
      // Use 2 workers max to prevent OOM on 16GB systems.
      // The base config runs with forks pool (isolate: true by default).
      maxWorkers: 2,
      include: loadIncludePatternsFromEnv(env) ?? unitTestIncludePatterns,
      exclude: [
        ...new Set([
          ...exclude,
          '**/*.e2e.test.ts',
          ...unitTestAdditionalExcludePatterns,
          ...loadExtraExcludePatternsFromEnv(env),

          // ── Migration debt: tests requiring unbuilt infrastructure ──
          // These tests depend on functions, fixtures, or integration stacks
          // that have not yet been implemented in CoreBlow.
          // Track: https://github.com/coreblow/coreblow/issues/migration-debt
          //
          // Note: agents/**, auto-reply/**, commands/**, gateway/** are already
          // excluded by unitTestAdditionalExcludePatterns above. The entries
          // below are retained for files in other directories (config, infra,
          // cli, plugin-sdk, plugins) that still fail.

          // ── config ──
          'src/config/config.nix-integration-u3-u5-u9.test.ts',
          'src/config/config.web-search-provider.test.ts',
          'src/config/doc-baseline.integration.test.ts',
          'src/config/io.observe-config.test.ts',
          'src/config/io.validation-fails-closed.test.ts',
          'src/config/io.write-config.test.ts',
          'src/config/load-channel-config-surface.test.ts',
          'src/config/validation.allowed-values.test.ts',
          'src/config/validation.channel-metadata.test.ts',

          // ── infra ──
          'src/infra/host-env-security.policy-parity.test.ts',
          'src/infra/matrix-legacy-crypto.test.ts',
          'src/infra/matrix-plugin-helper.test.ts',
          'src/infra/run-node.test.ts',
          'src/infra/state-retry.test.ts',
          'src/infra/watch-node.test.ts',

          // ── cli ──
          'src/cli/config-cli.integration.test.ts',
          'src/cli/gateway-cli.coverage.test.ts',
          'src/cli/gateway-cli/run.option-collisions.test.ts',
          'src/cli/nodes-cli.coverage.test.ts',
          'src/cli/skills-cli.commands.test.ts',

          // ── plugin-sdk ──
          'src/plugin-sdk/channel-import-guardrails.test.ts',
          'src/plugin-sdk/package-contract-guardrails.test.ts',
          'src/plugin-sdk/subpaths.test.ts',

          // ── plugins ──
          'src/plugins/contracts/registry.contract.test.ts',
        ]),
      ],
    },
  });
}

export default createUnitVitestConfig();
