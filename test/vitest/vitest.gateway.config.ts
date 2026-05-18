import { loadPatternListFromEnv } from './vitest.pattern-file.ts';
import { createScopedVitestConfig } from './vitest.scoped-config.ts';

export function loadIncludePatternsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  return loadPatternListFromEnv('COREBLOW_VITEST_INCLUDE_FILE', env);
}

export function createGatewayVitestConfig(env?: Record<string, string | undefined>) {
  return createScopedVitestConfig(
    loadIncludePatternsFromEnv(env) ?? ['src/gateway/**/*.test.ts'],
    {
      dir: 'src/gateway',
      env,
      exclude: [
      // ── Migration debt: gateway tests requiring unbuilt infrastructure ──
      // These paths are absolute (not relative to dir) because
      // createScopedVitestConfig.relativizeScopedPatterns handles the conversion.
      'src/gateway/client-callsites.guard.test.ts',
      'src/gateway/gateway.test.ts',
      'src/gateway/net-security.test.ts',
      'src/gateway/protocol/protocol.test.ts',
      'src/gateway/reconnect-gating.test.ts',
      'src/gateway/server-methods/nodes.invoke-wake.test.ts',
      'src/gateway/server.auth.compat-baseline.test.ts',
      'src/gateway/server.auth.control-ui.test.ts',
      'src/gateway/server.chat.gateway-server-chat.test.ts',
      'src/gateway/server.config-patch.test.ts',
      'src/gateway/server.node-pairing-authz.test.ts',
      'src/gateway/server.plugin-http-auth.test.ts',
      'src/gateway/server.reload.test.ts',
      'src/gateway/server.roles-allowlist-update.test.ts',
      'src/gateway/server.send-telegram-target-writeback-scope.test.ts',
      'src/gateway/server.sessions-send.test.ts',
      'src/gateway/server.talk-config.test.ts',
      'src/gateway/session-utils.test.ts',
      ],
    },
  );
}

export default createGatewayVitestConfig();
