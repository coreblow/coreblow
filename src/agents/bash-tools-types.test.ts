import { describe, it, expect } from 'vitest';
import { classifyCommandRisk, shouldAutoApprove, isSafeCommand } from './bash-tools-types.js';

describe('Bash Tools Types', () => {
    describe('classifyCommandRisk', () => {
        it('critical: rm -rf /', () => expect(classifyCommandRisk('rm -rf /')).toBe('critical'));
        it('critical: mkfs', () => expect(classifyCommandRisk('mkfs.ext4 /dev/sda')).toBe('critical'));
        it('high: sudo', () => expect(classifyCommandRisk('sudo apt install')).toBe('high'));
        it('high: rm -rf', () => expect(classifyCommandRisk('rm -rf temp/')).toBe('high'));
        it('medium: npm install', () => expect(classifyCommandRisk('npm install lodash')).toBe('medium'));
        it('medium: docker', () => expect(classifyCommandRisk('docker build .')).toBe('medium'));
        it('low: echo', () => expect(classifyCommandRisk('echo hello')).toBe('low'));
        it('low: ls', () => expect(classifyCommandRisk('ls -la')).toBe('low'));
    });

    describe('shouldAutoApprove', () => {
        it('auto policy → always', () => expect(shouldAutoApprove('rm -rf', 'auto')).toBe(true));
        it('manual → never', () => expect(shouldAutoApprove('echo hi', 'manual')).toBe(false));
        it('sandbox → always', () => expect(shouldAutoApprove('rm -rf', 'sandbox')).toBe(true));
        it('allowlist → in list', () => expect(shouldAutoApprove('echo hello', 'allowlist', ['echo'])).toBe(true));
        it('allowlist → not in list', () => expect(shouldAutoApprove('rm -rf', 'allowlist', ['echo'])).toBe(false));
    });

    describe('isSafeCommand', () => {
        it('echo', () => expect(isSafeCommand('echo hi')).toBe(true));
        it('ls', () => expect(isSafeCommand('ls -la')).toBe(true));
        it('cat', () => expect(isSafeCommand('cat file.txt')).toBe(true));
        it('rm', () => expect(isSafeCommand('rm file')).toBe(false));
        it('curl', () => expect(isSafeCommand('curl http://x')).toBe(false));
    });
});
