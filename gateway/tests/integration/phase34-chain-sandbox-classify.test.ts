/**
 * CoreBlow Phase 34 — Classify→Block→SanitizeEnv Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   classifyCommandRisk → isBlockedInRestrictedMode → buildSanitizedEnv
 */
import { describe, it, expect } from 'vitest';
import { classifyCommandRisk, isBlockedInRestrictedMode } from '../../src/sandbox/command-classifier.js';
import { buildSanitizedEnv } from '../../src/sandbox/exec-restricted.js';

describe('Phase34 Chain: Classify→Block→Sanitize Pipeline', () => {

    it('classify 10 commands → filter blocked → sanitize env for allowed', () => {
        const commands = [
            'ls -la',           // low
            'cat file.txt',     // low
            'echo hello',       // low
            'rm -rf /',         // high → blocked
            'sudo su',          // high → blocked
            'curl api.com',     // medium → allowed
            'node script.js',   // low
            'npm install foo',  // high → blocked
            'grep pattern',     // low
            'reboot',           // high → blocked
        ];

        const classifications = commands.map(cmd => ({
            cmd,
            ...classifyCommandRisk(cmd),
            ...isBlockedInRestrictedMode(cmd),
        }));

        // Verify classification counts
        const blocked = classifications.filter(c => c.blocked);
        const allowed = classifications.filter(c => !c.blocked);

        expect(blocked.length).toBe(4); // rm, sudo, npm, reboot
        expect(allowed.length).toBe(6);

        // For allowed commands, verify env is sanitized
        const env = buildSanitizedEnv();
        expect(env.OPENAI_API_KEY).toBeUndefined();
        expect(env.TERM).toBe('dumb');
    });

    it('multi-stage command pipeline: classify → block reason → escalation path', () => {
        // Step 1: User submits command
        const userCommand = 'sudo apt-get install malware';

        // Step 2: Classify risk
        const classification = classifyCommandRisk(userCommand);
        expect(classification.level).toBe('high');

        // Step 3: Check if blocked
        const blockResult = isBlockedInRestrictedMode(userCommand);
        expect(blockResult.blocked).toBe(true);
        expect(blockResult.reason).toContain('Docker required');

        // Step 4: If blocked → no execution, log reason
        expect(blockResult.reason).toBeTruthy();
    });

    it('safe command pipeline: classify → allowed → sanitized exec env', () => {
        const safeCmd = 'ls -la /tmp';

        // Step 1: Classify
        const { level } = classifyCommandRisk(safeCmd);
        expect(level).toBe('low');

        // Step 2: Not blocked
        const { blocked } = isBlockedInRestrictedMode(safeCmd);
        expect(blocked).toBe(false);

        // Step 3: Build sanitized env for execution
        const env = buildSanitizedEnv();
        expect(env.OPENAI_API_KEY).toBeUndefined();
        expect(env.GITHUB_TOKEN).toBeUndefined();
        expect(env.TERM).toBe('dumb');
    });
});
