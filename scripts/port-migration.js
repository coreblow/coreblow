// One-time migration script — not part of runtime.
// Used to port files from OpenClaw to CoreBlow namespace.
import fs from 'fs/promises';
import path from 'path';

const SRC_DIR = '/Users/febrinanda/openclaw-main/src';
const DEST_DIR = '/Users/febrinanda/coreblow/src';

const FILES_TO_PORT = [
    // Wave 28A
    'infra/file-identity.ts',
    'infra/shell-inline-command.ts',
    'infra/exec-safety.ts',
    'infra/exec-wrapper-tokens.ts',
    'infra/exec-allowlist-pattern.ts',
    'infra/system-run-normalize.ts',
    'infra/exec-obfuscation-detect.ts',
    'infra/exec-safe-bin-semantics.ts',
    'infra/executable-path.ts',
    'infra/machine-name.ts',
    'infra/node-commands.ts',
    'infra/json-files.ts',
    'infra/path-env.ts',
    'infra/device-identity.ts',
    'logger.ts',
    'globals.ts',
    'utils/shell-argv.ts',
    'utils/message-channel.ts',
    // Wave 28B
    'infra/exec-safe-bin-policy.ts',
    'infra/exec-safe-bin-policy-profiles.ts',
    'infra/exec-safe-bin-policy-validator.ts',
    'infra/exec-safe-bin-trust.ts',
    'infra/exec-safe-bin-runtime-policy.ts',
    'infra/exec-wrapper-resolution.ts',
    'infra/exec-wrapper-trust-plan.ts',
    'infra/exec-approval-command-display.ts',
    'infra/exec-inline-eval.ts',
    'infra/host-env-security.ts',
    'infra/exec-host.ts',
    'infra/system-run-command.ts',
    // Wave 28C
    'infra/exec-approvals.ts',
    'infra/exec-approvals-analysis.ts',
    'infra/exec-approvals-allowlist.ts',
    'infra/exec-command-resolution.ts',
    'infra/system-run-approval-binding.ts',
    'infra/system-run-approval-context.ts',
    // Wave 28D
    'node-host/invoke-types.ts',
    'node-host/with-timeout.ts',
    'node-host/config.ts',
    'node-host/exec-policy.ts',
    'node-host/invoke-system-run-plan.ts',
    'node-host/invoke-system-run-allowlist.ts',
    'node-host/invoke-system-run.ts',
    'node-host/invoke.ts',
    'node-host/runner.ts'
];

async function main() {
    for (const relPath of FILES_TO_PORT) {
        const srcPath = path.join(SRC_DIR, relPath);
        const destPath = path.join(DEST_DIR, relPath);

        try {
            let content = await fs.readFile(srcPath, 'utf8');

            // Apply namespace replacements safely to preserve parity
            content = content.replace(/OPENCLAW_/g, 'COREBLOW_');
            content = content.replace(/OPENCLAW/g, 'COREBLOW');
            content = content.replace(/OpenClaw/g, 'CoreBlow');
            // But retain openclaw for paths/refs where useful if there's any?
            // Actually, keep it simple. It's safe to replace openclaw -> coreblow.
            content = content.replace(/openclaw/g, 'coreblow');

            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.writeFile(destPath, content);
            console.log(`✅ Ported ${relPath}`);
        } catch (err) {
            console.error(`❌ Failed to port ${relPath}: ${err.message}`);
        }
    }
}

main().catch(console.error);
