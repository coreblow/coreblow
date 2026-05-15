import { channelTestExclude } from './vitest.channel-paths.mjs';
import { loadPatternListFromEnv } from './vitest.pattern-file.ts';
import { createScopedVitestConfig } from './vitest.scoped-config.ts';

export function loadIncludePatternsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  return loadPatternListFromEnv('COREBLOW_VITEST_INCLUDE_FILE', env);
}

export function createExtensionsVitestConfig(
  env: Record<string, string | undefined> = process.env,
) {
  return createScopedVitestConfig(
    loadIncludePatternsFromEnv(env) ?? ['extensions/**/*.test.ts'],
    {
      dir: 'extensions',
      env,
      passWithNoTests: true,
      exclude: [
        ...channelTestExclude.filter((pattern: string) => pattern.startsWith('extensions/')),

        // ── Migration debt: stub extensions with incomplete implementations ──
        'extensions/synology-chat/src/__tests__/channel.test.ts',
        'extensions/nostr/src/__tests__/channel.test.ts',
        'extensions/acpx/src/__tests__/runtime.test.ts',
        'extensions/voice-call/src/__tests__/runtime.test.ts',
      ],
    },
  );
}

export default createExtensionsVitestConfig();
