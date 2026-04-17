/**
 * Layer 3: Tool Approval test suite — CoreBlow pattern
 */
import { describe, it, expect } from 'vitest';
import { ToolApproval, type ApprovalConfig } from './approval.js';

describe('ToolApproval', () => {
    describe('ask: off', () => {
        const approval = new ToolApproval({ ask: 'off', allowlist: [], denylist: ['rm -rf'] });

        it('auto-approves everything not in denylist', () => {
            expect(approval.check('ls -la')).toBe('approved');
            expect(approval.check('curl example.com')).toBe('approved');
        });

        it('still denies denylist items', () => {
            expect(approval.check('rm -rf /')).toBe('denied');
        });
    });

    describe('ask: on-miss', () => {
        const approval = new ToolApproval({
            ask: 'on-miss',
            allowlist: ['ls', 'cat *', 'git *', 'npm *'],
            denylist: ['rm -rf', 'sudo *'],
        });

        it('approves allowlisted commands', () => {
            expect(approval.check('ls')).toBe('approved');
            expect(approval.check('ls -la')).toBe('approved');
            expect(approval.check('cat file.txt')).toBe('approved');
            expect(approval.check('git pull')).toBe('approved');
            expect(approval.check('npm install')).toBe('approved');
        });

        it('needs approval for unknown commands', () => {
            expect(approval.check('curl example.com')).toBe('needs-approval');
            expect(approval.check('wget file')).toBe('needs-approval');
        });

        it('denies denylist items', () => {
            expect(approval.check('rm -rf /')).toBe('denied');
            expect(approval.check('sudo rm -rf /')).toBe('denied');
        });
    });

    describe('ask: always', () => {
        const approval = new ToolApproval({ ask: 'always', allowlist: ['ls'], denylist: ['rm -rf'] });

        it('always needs approval (even allowlisted)', () => {
            expect(approval.check('ls -la')).toBe('needs-approval');
            expect(approval.check('echo hi')).toBe('needs-approval');
        });

        it('still denies denylist items', () => {
            expect(approval.check('rm -rf /')).toBe('denied');
        });
    });

    describe('glob matching', () => {
        const approval = new ToolApproval({
            ask: 'on-miss',
            allowlist: ['git *', 'npm *'],
            denylist: ['sudo *'],
        });

        it('matches glob wildcard patterns', () => {
            expect(approval.check('git push origin main')).toBe('approved');
            expect(approval.check('npm run build')).toBe('approved');
        });

        it('exact command match', () => {
            const a2 = new ToolApproval({ ask: 'on-miss', allowlist: ['pwd'], denylist: [] });
            expect(a2.check('pwd')).toBe('approved');
        });
    });

    describe('approval queue', () => {
        const approval = new ToolApproval({ ask: 'always', allowlist: [], denylist: [] });

        it('creates pending request', () => {
            const req = approval.requestApproval('curl example.com', 'exec', 'default');
            expect(req.status).toBe('pending');
            expect(req.command).toBe('curl example.com');

            expect(approval.getPending()).toHaveLength(1);
        });

        it('approves request', () => {
            const req = approval.requestApproval('test cmd', 'exec', 'default');
            const result = approval.approve(req.id);
            expect(result).toBe(true);
        });

        it('denies request', () => {
            const req = approval.requestApproval('bad cmd', 'exec', 'default');
            const result = approval.deny(req.id);
            expect(result).toBe(true);
        });

        it('returns false for invalid request ID', () => {
            expect(approval.approve('nonexistent')).toBe(false);
            expect(approval.deny('nonexistent')).toBe(false);
        });
    });

    describe('default config', () => {
        const approval = new ToolApproval();

        it('has on-miss as default mode', () => {
            expect(approval.getConfig().ask).toBe('on-miss');
        });

        it('allows default allowlist commands', () => {
            expect(approval.check('ls')).toBe('approved');
            expect(approval.check('git status')).toBe('approved');
            expect(approval.check('node script.js')).toBe('approved');
        });

        it('denies default denylist', () => {
            expect(approval.check('rm -rf /')).toBe('denied');
            expect(approval.check('sudo rm -rf')).toBe('denied');
        });
    });
});
