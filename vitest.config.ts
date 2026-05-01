import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { pluginSdkSubpaths } from './scripts/lib/plugin-sdk-entries.mjs';
import { resolveLocalVitestMaxWorkers } from './scripts/test-planner/runtime-profile.mjs';

export { resolveLocalVitestMaxWorkers };

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isWindows = process.platform === 'win32';
const localWorkers = resolveLocalVitestMaxWorkers();
const ciWorkers = isWindows ? 2 : 3;

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'],
        alias: [
            // ── CoreBlow self-referential package aliases (OC pattern) ──
            // Keep this ordered: the base `coreblow/plugin-sdk` alias is a prefix match.
            {
                find: 'coreblow/extension-api',
                replacement: path.join(repoRoot, 'src', 'extensionAPI.ts'),
            },
            // Explicit per-subpath alias (OC pattern) — more reliable than regex wildcard.
            // Generated from scripts/lib/plugin-sdk-entrypoints.json.
            ...pluginSdkSubpaths.map((subpath: string) => ({
                find: `coreblow/plugin-sdk/${subpath}`,
                replacement: path.join(repoRoot, 'src', 'plugin-sdk', `${subpath}.ts`),
            })),
            {
                find: 'coreblow/plugin-sdk',
                replacement: path.join(repoRoot, 'src', 'plugin-sdk', 'index.ts'),
            },
            // ── Third-party stubs ──
            // Stub for fake-indexeddb (used by extensions/matrix)
            {
                find: 'fake-indexeddb/auto',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            {
                find: 'fake-indexeddb',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            // Stub for music-metadata (used by extensions/matrix)
            {
                find: 'music-metadata',
                replacement: path.resolve(repoRoot, 'src/stubs/music-metadata.ts'),
            },
            // Stub for Grammy throttler (used by extensions/telegram)
            {
                find: '@grammyjs/transformer-throttler',
                replacement: path.resolve(repoRoot, 'src/stubs/grammyjs-throttler.ts'),
            },
            // Stubs only for packages that are NOT installed (native/optional deps)
            // NOTE: matrix-js-sdk and markdown-it are installed — use real packages!
            {
                find: '@matrix-org/matrix-sdk-crypto-nodejs',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            // Stub for @whiskeysockets/baileys (used by extensions/whatsapp)
            {
                find: '@whiskeysockets/baileys',
                replacement: path.resolve(repoRoot, 'src/stubs/whiskeysockets-baileys.ts'),
            },
            // Stub for node-edge-tts (optional native dep, used by extensions/microsoft)
            {
                find: /^node-edge-tts(\/.*)?$/,
                replacement: path.resolve(repoRoot, 'src/stubs/node-edge-tts.ts'),
            },
        ],
    },
    test: {
        testTimeout: 120_000,
        hookTimeout: 120_000,
        teardownTimeout: 10_000,
        unstubEnvs: true,
        unstubGlobals: true,
        pool: 'forks',
        maxWorkers: isCI ? ciWorkers : localWorkers,
        env: {
            // Prevent Chalk / subsystem logger from injecting ANSI escape codes in
            // test output. Without this, tests that assert on log message contents
            // (e.g. model-fallback sanitization) can fail in color-capable terminals.
            NO_COLOR: '1',
        },
        include: [
            'src/**/*.test.ts',
            'tests/**/*.test.ts',
            // Wave 3/4: extension pure-logic tests (non-e2e, non-live)
            'extensions/discord/src/**/*.test.ts',
            'extensions/telegram/src/**/*.test.ts',
            'extensions/slack/src/**/*.test.ts',
            'extensions/matrix/src/**/*.test.ts',
            'extensions/browser/src/**/*.test.ts',
            // Wave 4 Batch 4A-4D: flat extension tests (constants, pure logic)
            'extensions/openai/**/*.test.ts',
            'extensions/xai/**/*.test.ts',
            'extensions/mistral/**/*.test.ts',
            'extensions/ollama/**/*.test.ts',
            'extensions/deepseek/**/*.test.ts',
            'extensions/anthropic/**/*.test.ts',
            'extensions/google/**/*.test.ts',
            'extensions/moonshot/**/*.test.ts',
            'extensions/github-copilot/**/*.test.ts',
            'extensions/groq/**/*.test.ts',
            'extensions/together/**/*.test.ts',
            'extensions/deepgram/**/*.test.ts',
            'extensions/elevenlabs/**/*.test.ts',
            'extensions/huggingface/**/*.test.ts',
            'extensions/duckduckgo/**/*.test.ts',
            'extensions/firecrawl/**/*.test.ts',
            'extensions/tavily/**/*.test.ts',
            'extensions/exa/**/*.test.ts',
            'extensions/fal/**/*.test.ts',
            'extensions/perplexity/**/*.test.ts',
            'extensions/sglang/**/*.test.ts',
            'extensions/vllm/**/*.test.ts',
            'extensions/litellm/**/*.test.ts',
            'extensions/openrouter/**/*.test.ts',
            'extensions/chutes/**/*.test.ts',
            'extensions/bluesky/**/*.test.ts',
            'extensions/mqtt/**/*.test.ts',
            // Wave 4 Batch 4E: additional extensions
            'extensions/minimax/**/*.test.ts',
            'extensions/modelstudio/**/*.test.ts',
            'extensions/kilocode/**/*.test.ts',
            'extensions/vercel-ai-gateway/**/*.test.ts',
            'extensions/microsoft-foundry/**/*.test.ts',
            'extensions/microsoft/**/*.test.ts',
            'extensions/zai/**/*.test.ts',
            'extensions/openshell/**/*.test.ts',
            'extensions/venice/**/*.test.ts',
            'extensions/synthetic/**/*.test.ts',
            'extensions/chutes/**/*.test.ts',
            'extensions/qianfan/**/*.test.ts',
            'extensions/volcengine/**/*.test.ts',
            'extensions/xiaomi/**/*.test.ts',
            'extensions/vllm/**/*.test.ts',
            'extensions/sglang/**/*.test.ts',
            'extensions/kimi-coding/**/*.test.ts',
            // Wave 4 Batch 4H: remaining extensions
            'extensions/byteplus/**/*.test.ts',
            'extensions/cloudflare-ai-gateway/**/*.test.ts',
            'extensions/anthropic-vertex/**/*.test.ts',
            'extensions/opencode/**/*.test.ts',
            'extensions/opencode-go/**/*.test.ts',
            'extensions/brave/**/*.test.ts',
            'extensions/nvidia/**/*.test.ts',
            'extensions/amazon-bedrock/**/*.test.ts',
            'extensions/elevenlabs/**/*.test.ts',
            'extensions/microsoft/**/*.test.ts',
            'extensions/image-generation-core/**/*.test.ts',
            'extensions/speech-core/**/*.test.ts',
            'extensions/auto-reply/**/*.test.ts',
            'extensions/diagnostics/**/*.test.ts',
            'extensions/gemini-auth/**/*.test.ts',
            'extensions/google-chat/**/*.test.ts',
            'extensions/link-understanding/**/*.test.ts',
            'extensions/media-understanding-core/**/*.test.ts',
            'extensions/minimax-auth/**/*.test.ts',
            'extensions/qwen-auth/**/*.test.ts',
            'extensions/tts/**/*.test.ts',
        ],
        setupFiles: ['test/setup.ts'],
        exclude: [
            // ── Global globs (OC pattern: minimal, principled list) ──
            'dist/**',
            'test/fixtures/**',
            '**/node_modules/**',
            '**/vendor/**',
            '**/*.live.test.ts',
            '**/*.e2e.test.ts',
            // canvas-host tests require chokidar watcher runtime
            'src/canvas-host/**/*.test.ts',
            // Extension live/e2e tests require network/browser runtime
            'extensions/**/*.e2e.test.ts',
            'extensions/**/*.live.test.ts',
            // cron-protocol-conformance requires optional ui/ workspace
            'src/cron/cron-protocol-conformance.test.ts',

            // ── Per-file excludes: require full integration stack ──
            // security: requires os-level audit tools
            'src/security/audit-extra.sync.test.ts',
            'src/security/audit.test.ts',
            'src/security/fix.test.ts',
            // index test wires entire runtime
            'src/index.test.ts',
            // requires pdf-parse native binary
            'src/agents/tools/pdf-tool.test.ts',
            // requires full extension dependency tree (all channels)
            'src/commands/status.test.ts',

            // ── Agents: require full provider plugin runtime ──
            'src/agents/bootstrap.test.ts',
            'src/agents/btw.test.ts',
            'src/agents/command/delivery.test.ts',
            'src/agents/live-model-switch.test.ts',
            'src/agents/model-auth.test.ts',
            'src/agents/pi-embedded-runner/extensions.test.ts',
            'src/agents/pi-embedded-runner/google.test.ts',
            'src/agents/pi-embedded-runner/model.test.ts',
            'src/agents/pi-embedded-runner/run/attempt.test.ts',
            'src/agents/pi-embedded-runner/runs.test.ts',
            'src/agents/pi-embedded-subscribe.handlers.tools.test.ts',
            'src/agents/pi-extensions/compaction-safeguard.test.ts',
            'src/agents/pi-tool-definition-adapter.test.ts',
            'src/agents/pi-tools.schema.test.ts',
            'src/agents/sandbox/ssh-backend.test.ts',
            'src/agents/session-persistence-phase11.test.ts',
            'src/agents/subagent/announce-delivery.test.ts',
            'src/agents/subagent/orphan-recovery.test.ts',
            'src/agents/subagent/spawn.test.ts',
            'src/agents/tools/image-generate-tool.test.ts',
            'src/agents/turn-engine/sandbox/sandbox.test.ts',

            // ── Auto-reply: require full message dispatch stack ──
            'src/auto-reply/reply/reply-payloads.test.ts',
            'src/auto-reply/reply/agent-runner-execution.test.ts',
            'src/auto-reply/reply/commands-acp.test.ts',
            'src/auto-reply/reply/commands-acp/context.test.ts',
            'src/auto-reply/reply/commands.test.ts',
            'src/auto-reply/reply/dispatch-acp-delivery.test.ts',
            'src/auto-reply/reply/inbound-dedupe.test.ts',
            'src/auto-reply/reply/session.test.ts',
            'src/auto-reply/reply/telegram-context.test.ts',
            'src/auto-reply/status.test.ts',

            // ── Channels: require external plugin-sdk (googlechat) ──
            'src/channels/plugins/target-parsing.test.ts',

            // ── CLI: require cli test helpers ──
            'src/cli/cron-cli.test.ts',
            'src/cli/daemon-cli/status.gather.test.ts',
            'src/cli/mcp-cli.test.ts',
            'src/cli/logs-cli.test.ts',

            // ── Commands: require full plugin runtime ──
            'src/commands/auth-choice-options.test.ts',
            'src/commands/configure.wizard.test.ts',
            'src/commands/doctor-gateway-daemon-flow.test.ts',
            'src/commands/doctor-gateway-services.test.ts',
            'src/commands/doctor-memory-search.test.ts',
            'src/commands/doctor/providers/telegram.test.ts',
            'src/commands/onboard-search.test.ts',
            'src/commands/sessions-cleanup.test.ts',
            'src/commands/doctor-gateway-auth-token.test.ts',
            'src/commands/agents.test.ts',
            'src/commands/agent.test.ts',

            // ── Config ──
            'src/config/plugin-auto-enable.test.ts',

            // ── Gateway: require live HTTP server ──
            'src/gateway/config-validator.test.ts',
            'src/gateway/embeddings-http.test.ts',
            'src/gateway/hooks.test.ts',
            'src/gateway/model-pricing-cache.test.ts',
            'src/gateway/models-http.test.ts',
            'src/gateway/openai-http.test.ts',
            'src/gateway/openresponses-http.test.ts',
            'src/gateway/orchestrator.test.ts',
            'src/gateway/server-impl.test.ts',
            'src/gateway/server-methods/agents-mutate.test.ts',
            'src/gateway/server-methods/tools-effective.test.ts',
            'src/gateway/server-methods/usage.test.ts',
            'src/gateway/server-node-events.test.ts',
            'src/gateway/server-session-key.test.ts',
            'src/gateway/ws-handler.test.ts',
            'src/gateway/probe-auth.test.ts',
            'src/gateway/method-scopes.test.ts',

            // ── Hooks ──
            'src/hooks/install.test.ts',

            // ── Infra: require runner harness / external deps ──
            'src/infra/exec-approval-forwarder.test.ts',
            'src/infra/machine-name.test.ts',
            'src/infra/state-migrations.test.ts',
            'src/infra/provider-usage.load.test.ts',
            'src/infra/session-cost-usage.test.ts',
            // @whiskeysockets/baileys (whatsapp native dep)
            'src/infra/outbound/current-conversation-bindings.test.ts',
            'src/infra/outbound/deliver.test.ts',
            'src/infra/outbound/outbound-session.test.ts',
            'src/infra/outbound/session-binding-service.test.ts',
            'src/infra/outbound/targets.test.ts',

            // ── ACP: require lifecycle harness ──
            'src/acp/persistent-bindings.lifecycle.test.ts',
            'src/secrets/target-registry.test.ts',

            // ── MCP ──
            'src/mcp/channel-server.test.ts',

            // ── Media understanding: require model runtime ──
            'src/media-understanding/apply.test.ts',
            'src/media-understanding/runtime.test.ts',
            'src/media/store.test.ts',

            // ── Plugins: require full plugin loader ──
            'src/plugins/bundled-plugin-metadata.test.ts',
            'src/plugins/bundled-provider-auth-env-vars.test.ts',
            'src/plugins/commands.test.ts',
            'src/plugins/install.test.ts',
            'src/plugins/loader.test.ts',
            'src/plugins/runtime/index.test.ts',
            'src/plugins/web-search-providers.test.ts',
            'src/plugins/services.test.ts',

            // ── Process ──
            'src/process/command-queue.test.ts',

            // ── TUI: Ink render loop (hangs without timeout guard) ──
            'src/tui/components/chat-log.test.ts',

            // ── Utils ──
            'src/utils/usage-format.test.ts',

            // ── Wizard: require interactive setup ──
            'src/wizard/setup.finalize.test.ts',
            'src/wizard/setup.gateway-config.test.ts',
            'src/wizard/setup.test.ts',

            // ── Image generation: circular dep (resolved in separate built packages in OC) ──
            'src/image-generation/runtime.test.ts',
        ],
    },
});
