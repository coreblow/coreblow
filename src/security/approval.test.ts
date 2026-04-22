import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { ToolApproval } from './approval.js';
import type { AskMode, ApprovalResult } from './approval.js';

describe('ToolApproval', () => {
    let tool: ToolApproval;

    beforeEach(() => {
        vi.useFakeTimers();
        tool = new ToolApproval();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── Default Config ──────────────────────────────────────────

    describe('default config', () => {
        it('should default to on-miss mode', () => {
            expect(tool.getConfig().ask).toBe('on-miss');
        });

        it('should have a populated allowlist', () => {
            expect(tool.getConfig().allowlist.length).toBeGreaterThan(0);
        });

        it('should have a populated denylist', () => {
            expect(tool.getConfig().denylist.length).toBeGreaterThan(0);
        });
    });

    // ─── Denylist (always checked first) ─────────────────────────

    describe('denylist — always denied', () => {
        it('should deny "rm -rf /" regardless of mode', () => {
            expect(tool.check('rm -rf /')).toBe('denied');
        });

        it('should deny sudo commands', () => {
            expect(tool.check('sudo apt install foo')).toBe('denied');
        });

        it('should deny shutdown', () => {
            expect(tool.check('shutdown now')).toBe('denied');
        });

        it('should deny reboot', () => {
            expect(tool.check('reboot')).toBe('denied');
        });

        it('should deny chmod 777', () => {
            expect(tool.check('chmod 777 /etc/passwd')).toBe('denied');
        });

        it('should deny kill -9 1', () => {
            expect(tool.check('kill -9 1')).toBe('denied');
        });

        it('should deny fork bomb', () => {
            expect(tool.check(':(){:|:&};:')).toBe('denied');
        });

        it('should deny denylist even in ask=off mode', () => {
            const offTool = new ToolApproval({ ask: 'off' });
            expect(offTool.check('sudo rm -rf /')).toBe('denied');
        });
    });

    // ─── Mode: on-miss (default) ─────────────────────────────────

    describe('mode: on-miss', () => {
        it('should approve allowlisted exact command: ls', () => {
            expect(tool.check('ls')).toBe('approved');
        });

        it('should approve allowlisted command with args: ls -la', () => {
            expect(tool.check('ls -la')).toBe('approved');
        });

        it('should approve wildcard: git pull', () => {
            expect(tool.check('git pull')).toBe('approved');
        });

        it('should approve wildcard: git push origin main', () => {
            expect(tool.check('git push origin main')).toBe('approved');
        });

        it('should approve wildcard: npm install', () => {
            expect(tool.check('npm install')).toBe('approved');
        });

        it('should approve wildcard: pnpm exec vitest', () => {
            expect(tool.check('pnpm exec vitest')).toBe('approved');
        });

        it('should approve: python3 script.py', () => {
            expect(tool.check('python3 script.py')).toBe('approved');
        });

        it('should return needs-approval for unknown command', () => {
            expect(tool.check('curl https://example.com')).toBe('needs-approval');
        });

        it('should return needs-approval for wget', () => {
            expect(tool.check('wget https://example.com')).toBe('needs-approval');
        });

        it('should trim whitespace before checking', () => {
            expect(tool.check('  ls  ')).toBe('approved');
        });
    });

    // ─── Mode: off ───────────────────────────────────────────────

    describe('mode: off', () => {
        let offTool: ToolApproval;

        beforeEach(() => {
            offTool = new ToolApproval({ ask: 'off' });
        });

        it('should auto-approve everything not in denylist', () => {
            expect(offTool.check('curl https://example.com')).toBe('approved');
            expect(offTool.check('wget file')).toBe('approved');
            expect(offTool.check('any-random-command')).toBe('approved');
        });

        it('should still deny denylisted commands', () => {
            expect(offTool.check('sudo rm -rf /')).toBe('denied');
        });
    });

    // ─── Mode: always ────────────────────────────────────────────

    describe('mode: always', () => {
        let alwaysTool: ToolApproval;

        beforeEach(() => {
            alwaysTool = new ToolApproval({ ask: 'always' });
        });

        it('should always return needs-approval for safe commands', () => {
            expect(alwaysTool.check('ls')).toBe('needs-approval');
            expect(alwaysTool.check('git pull')).toBe('needs-approval');
        });

        it('should still deny denylisted commands', () => {
            expect(alwaysTool.check('sudo rm -rf /')).toBe('denied');
        });
    });

    // ─── Custom Config ───────────────────────────────────────────

    describe('custom config', () => {
        it('should merge custom allowlist with defaults', () => {
            const custom = new ToolApproval({ allowlist: ['mycmd'] });
            expect(custom.check('mycmd')).toBe('approved');
        });

        it('should merge custom denylist with defaults', () => {
            const custom = new ToolApproval({ denylist: ['danger-cmd'] });
            expect(custom.check('danger-cmd')).toBe('denied');
        });
    });

    // ─── Request / Approve / Deny Flow ───────────────────────────

    describe('requestApproval', () => {
        it('should create a pending request with unique ID', () => {
            const req = tool.requestApproval('curl https://example.com', 'exec', 'agent-1');
            expect(req.id).toMatch(/^apr_/);
            expect(req.command).toBe('curl https://example.com');
            expect(req.tool).toBe('exec');
            expect(req.agentId).toBe('agent-1');
            expect(req.status).toBe('pending');
            expect(req.timestamp).toBeGreaterThan(0);
        });

        it('should include optional source', () => {
            const req = tool.requestApproval('cmd', 'exec', 'agent-1', 'discord');
            expect(req.source).toBe('discord');
        });

        it('should add request to pending list', () => {
            tool.requestApproval('cmd1', 'exec', 'a1');
            tool.requestApproval('cmd2', 'exec', 'a2');
            expect(tool.getPending()).toHaveLength(2);
        });
    });

    describe('approve', () => {
        it('should approve a pending request and return true', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            expect(tool.approve(req.id)).toBe(true);
            expect(req.status).toBe('approved');
        });

        it('should remove approved request from pending', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            tool.approve(req.id);
            expect(tool.getPending()).toHaveLength(0);
        });

        it('should return false for non-existent request', () => {
            expect(tool.approve('nonexistent')).toBe(false);
        });

        it('should return false for already-approved request', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            tool.approve(req.id);
            expect(tool.approve(req.id)).toBe(false);
        });
    });

    describe('deny', () => {
        it('should deny a pending request and return true', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            expect(tool.deny(req.id)).toBe(true);
            expect(req.status).toBe('denied');
        });

        it('should remove denied request from pending', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            tool.deny(req.id);
            expect(tool.getPending()).toHaveLength(0);
        });

        it('should return false for non-existent request', () => {
            expect(tool.deny('nonexistent')).toBe(false);
        });
    });

    // ─── Auto-Expiry ─────────────────────────────────────────────

    describe('auto-expiry', () => {
        it('should expire pending requests after timeout', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            expect(tool.getPending()).toHaveLength(1);

            vi.advanceTimersByTime(300_001);

            expect(req.status).toBe('expired');
            expect(tool.getPending()).toHaveLength(0);
        });

        it('should not expire already-approved requests', () => {
            const req = tool.requestApproval('cmd', 'exec', 'a1');
            tool.approve(req.id);
            vi.advanceTimersByTime(300_001);
            expect(req.status).toBe('approved');
        });

        it('should respect custom timeout', () => {
            const customTool = new ToolApproval({}, 5000);
            const req = customTool.requestApproval('cmd', 'exec', 'a1');
            vi.advanceTimersByTime(4999);
            expect(req.status).toBe('pending');
            vi.advanceTimersByTime(2);
            expect(req.status).toBe('expired');
        });
    });

    // ─── Glob Matching Edge Cases ────────────────────────────────

    describe('glob matching', () => {
        it('exact match: "pwd" should match "pwd"', () => {
            expect(tool.check('pwd')).toBe('approved');
        });

        it('exact match with args: "echo hello" should match "echo *"', () => {
            expect(tool.check('echo hello')).toBe('approved');
        });

        it('should NOT match partial command names', () => {
            // "lsof" should not match "ls"
            expect(tool.check('lsof')).toBe('needs-approval');
        });
    });
});
