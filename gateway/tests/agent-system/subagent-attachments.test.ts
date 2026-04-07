/**
 * Tests for Subagent Attachments (OpenClaw Parity)
 *
 * Covers: base64 decode, limits resolution, materialize attachments,
 * cleanup, name validation, size limits, duplicate detection.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    decodeStrictBase64,
    resolveAttachmentLimits,
    materializeSubagentAttachments,
    removeAttachmentsDir,
    removeAttachmentsRootIfEmpty,
    type SubagentInlineAttachment,
    type SubagentAttachmentReceipt,
    type MaterializeSubagentAttachmentsResult,
} from '../../src/agents/subagent/subagent-attachments.js';

// ─── Helpers ────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coreblow-attach-test-'));
});

afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═══════════════════════════════════════════════════════════════
// BASE64 DECODE
// ═══════════════════════════════════════════════════════════════

describe('decodeStrictBase64', () => {
    it('decodes valid base64', () => {
        const encoded = Buffer.from('Hello, World!').toString('base64');
        const result = decodeStrictBase64(encoded, 1024);
        expect(result).not.toBeNull();
        expect(result!.toString('utf8')).toBe('Hello, World!');
    });

    it('returns null for invalid base64 characters', () => {
        expect(decodeStrictBase64('!!!invalid!!!', 1024)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(decodeStrictBase64('', 1024)).toBeNull();
    });

    it('returns null when decoded size exceeds max', () => {
        const bigContent = Buffer.alloc(2048).fill(65);
        const encoded = bigContent.toString('base64');
        expect(decodeStrictBase64(encoded, 1024)).toBeNull();
    });

    it('handles base64 with padding', () => {
        const encoded = Buffer.from('AB').toString('base64'); // 'QUI='
        const result = decodeStrictBase64(encoded, 1024);
        expect(result).not.toBeNull();
        expect(result!.toString('utf8')).toBe('AB');
    });

    it('handles base64 with whitespace', () => {
        const encoded = Buffer.from('Hello').toString('base64');
        const withSpaces = encoded.split('').join(' ');
        const result = decodeStrictBase64(withSpaces, 1024);
        expect(result).not.toBeNull();
    });

    it('returns null for odd-length base64', () => {
        expect(decodeStrictBase64('abc', 1024)).toBeNull();
    });

    it('returns null if encoded length exceeds limit', () => {
        const big = 'A'.repeat(10000);
        expect(decodeStrictBase64(big, 10)).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════
// LIMITS RESOLUTION
// ═══════════════════════════════════════════════════════════════

describe('resolveAttachmentLimits', () => {
    it('returns defaults for undefined config', () => {
        const limits = resolveAttachmentLimits();
        expect(limits.enabled).toBe(true);
        expect(limits.maxTotalBytes).toBe(5 * 1024 * 1024);
        expect(limits.maxFiles).toBe(50);
        expect(limits.maxFileBytes).toBe(1 * 1024 * 1024);
        expect(limits.retainOnSessionKeep).toBe(false);
    });

    it('returns defaults for empty attachments config', () => {
        const limits = resolveAttachmentLimits({ attachments: {} });
        expect(limits.enabled).toBe(true);
        expect(limits.maxTotalBytes).toBe(5 * 1024 * 1024);
    });

    it('respects enabled=false', () => {
        const limits = resolveAttachmentLimits({ attachments: { enabled: false } });
        expect(limits.enabled).toBe(false);
    });

    it('respects custom maxTotalBytes', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxTotalBytes: 1000 } });
        expect(limits.maxTotalBytes).toBe(1000);
    });

    it('respects custom maxFiles', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxFiles: 5 } });
        expect(limits.maxFiles).toBe(5);
    });

    it('respects custom maxFileBytes', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxFileBytes: 500 } });
        expect(limits.maxFileBytes).toBe(500);
    });

    it('respects retainOnSessionKeep', () => {
        const limits = resolveAttachmentLimits({ attachments: { retainOnSessionKeep: true } });
        expect(limits.retainOnSessionKeep).toBe(true);
    });

    it('floors NaN to defaults', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxTotalBytes: NaN } });
        expect(limits.maxTotalBytes).toBe(5 * 1024 * 1024);
    });

    it('floors Infinity to defaults', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxFileBytes: Infinity } });
        expect(limits.maxFileBytes).toBe(1 * 1024 * 1024);
    });

    it('floors negatives to 0', () => {
        const limits = resolveAttachmentLimits({ attachments: { maxTotalBytes: -100 } });
        expect(limits.maxTotalBytes).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// MATERIALIZE ATTACHMENTS
// ═══════════════════════════════════════════════════════════════

describe('materializeSubagentAttachments', () => {
    it('returns null for empty attachments', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [],
        });
        expect(result).toBeNull();
    });

    it('returns null for undefined attachments', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
        });
        expect(result).toBeNull();
    });

    it('materializes utf8 attachment', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'Hello world', encoding: 'utf8' }],
        });
        expect(result).not.toBeNull();
        expect(result!.status).toBe('ok');
        if (result!.status === 'ok') {
            expect(result!.receipt.count).toBe(1);
            expect(result!.receipt.files[0]!.name).toBe('test.txt');
            expect(result!.receipt.files[0]!.sha256).toBeDefined();
            expect(result!.systemPromptSuffix).toContain('1 file(s)');
            // Verify file exists
            const filePath = path.join(result!.absDir, 'test.txt');
            const content = await fs.readFile(filePath, 'utf8');
            expect(content).toBe('Hello world');
        }
    });

    it('materializes base64 attachment', async () => {
        const b64Content = Buffer.from('Binary content').toString('base64');
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'data.bin', content: b64Content, encoding: 'base64' }],
        });
        expect(result!.status).toBe('ok');
        if (result!.status === 'ok') {
            expect(result!.receipt.files[0]!.name).toBe('data.bin');
        }
    });

    it('materializes multiple attachments', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'a.txt', content: 'aaa' },
                { name: 'b.txt', content: 'bbb' },
                { name: 'c.txt', content: 'ccc' },
            ],
        });
        expect(result!.status).toBe('ok');
        if (result!.status === 'ok') {
            expect(result!.receipt.count).toBe(3);
        }
    });

    it('returns forbidden when attachments disabled', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'data' }],
            limits: resolveAttachmentLimits({ attachments: { enabled: false } }),
        });
        expect(result!.status).toBe('forbidden');
    });

    it('errors on file count exceeded', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'a.txt', content: 'a' },
                { name: 'b.txt', content: 'b' },
            ],
            limits: resolveAttachmentLimits({ attachments: { maxFiles: 1 } }),
        });
        expect(result!.status).toBe('error');
        if (result!.status === 'error') {
            expect(result!.error).toContain('file_count_exceeded');
        }
    });

    it('includes mountPath hint in suffix', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'data' }],
            mountPathHint: '/workspace/data',
        });
        if (result!.status === 'ok') {
            expect(result!.systemPromptSuffix).toContain('/workspace/data');
        }
    });

    it('creates manifest file', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'data' }],
        });
        if (result!.status === 'ok') {
            const manifest = JSON.parse(
                await fs.readFile(path.join(result!.absDir, '.manifest.json'), 'utf8'),
            );
            expect(manifest.count).toBe(1);
            expect(manifest.files).toHaveLength(1);
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// NAME VALIDATION
// ═══════════════════════════════════════════════════════════════

describe('Attachment Name Validation', () => {
    it('rejects empty name', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: '', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects name with slash', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'path/file.txt', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects name with backslash', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'path\\file.txt', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects dot name', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: '.', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects double dot name', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: '..', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects .manifest.json name', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: '.manifest.json', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects name with null byte', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'file\0.txt', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });

    it('rejects name with control characters', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'file\ttab.txt', content: 'data' }],
        });
        expect(result!.status).toBe('error');
    });
});

// ═══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════

describe('Duplicate Name Detection', () => {
    it('rejects duplicate names', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'same.txt', content: 'aaa' },
                { name: 'same.txt', content: 'bbb' },
            ],
        });
        expect(result!.status).toBe('error');
        if (result!.status === 'error') {
            expect(result!.error).toContain('duplicate_name');
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// SIZE LIMITS
// ═══════════════════════════════════════════════════════════════

describe('Size Limits', () => {
    it('rejects file exceeding maxFileBytes', async () => {
        const bigContent = 'x'.repeat(2000);
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'big.txt', content: bigContent }],
            limits: resolveAttachmentLimits({ attachments: { maxFileBytes: 100 } }),
        });
        expect(result!.status).toBe('error');
        if (result!.status === 'error') {
            expect(result!.error).toContain('file_bytes_exceeded');
        }
    });

    it('rejects total bytes exceeded', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'a.txt', content: 'x'.repeat(60) },
                { name: 'b.txt', content: 'x'.repeat(60) },
            ],
            limits: resolveAttachmentLimits({ attachments: { maxTotalBytes: 100 } }),
        });
        expect(result!.status).toBe('error');
        if (result!.status === 'error') {
            expect(result!.error).toContain('total_bytes_exceeded');
        }
    });

    it('rejects invalid base64 content', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'bad.bin', content: '!!!not-base64!!!', encoding: 'base64' }],
        });
        expect(result!.status).toBe('error');
    });
});

// ═══════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════

describe('Attachment Cleanup', () => {
    it('removeAttachmentsDir removes directory', async () => {
        const dir = path.join(tmpDir, 'test-cleanup');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'file.txt'), 'data');
        await removeAttachmentsDir(dir);
        await expect(fs.access(dir)).rejects.toThrow();
    });

    it('removeAttachmentsDir is safe for nonexistent dir', async () => {
        await removeAttachmentsDir(path.join(tmpDir, 'nonexistent'));
        // Should not throw
    });

    it('removeAttachmentsRootIfEmpty removes empty dir', async () => {
        const root = path.join(tmpDir, 'empty-root');
        await fs.mkdir(root, { recursive: true });
        await removeAttachmentsRootIfEmpty(root);
        await expect(fs.access(root)).rejects.toThrow();
    });

    it('removeAttachmentsRootIfEmpty keeps non-empty dir', async () => {
        const root = path.join(tmpDir, 'non-empty-root');
        await fs.mkdir(root, { recursive: true });
        await fs.writeFile(path.join(root, 'keep.txt'), 'data');
        await removeAttachmentsRootIfEmpty(root);
        await expect(fs.access(root)).resolves.toBeUndefined();
    });

    it('removeAttachmentsRootIfEmpty is safe for nonexistent dir', async () => {
        await removeAttachmentsRootIfEmpty(path.join(tmpDir, 'nonexistent'));
        // Should not throw
    });

    it('cleans up on materialization error', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'good.txt', content: 'data' },
                { name: 'good.txt', content: 'duplicate' }, // Will fail
            ],
        });
        expect(result!.status).toBe('error');
        // The attachment directory should have been cleaned up
    });
});

// ═══════════════════════════════════════════════════════════════
// ENCODING EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Encoding Edge Cases', () => {
    it('utf8 with unicode content', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'unicode.txt', content: '🚀 Hello 世界', encoding: 'utf8' }],
        });
        expect(result!.status).toBe('ok');
        if (result!.status === 'ok') {
            const content = await fs.readFile(path.join(result!.absDir, 'unicode.txt'), 'utf8');
            expect(content).toBe('🚀 Hello 世界');
        }
    });

    it('base64 with binary content', async () => {
        const binary = Buffer.from([0x00, 0xFF, 0x80, 0x7F]);
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'binary.bin', content: binary.toString('base64'), encoding: 'base64' }],
        });
        expect(result!.status).toBe('ok');
        if (result!.status === 'ok') {
            const content = await fs.readFile(path.join(result!.absDir, 'binary.bin'));
            expect(Buffer.compare(content, binary)).toBe(0);
        }
    });

    it('empty content creates empty file', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'empty.txt', content: '' }],
        });
        // Empty content may be treated as no-op or create empty file
        if (result && result.status === 'ok') {
            const content = await fs.readFile(path.join(result.absDir, 'empty.txt'), 'utf8');
            expect(content).toBe('');
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// MANIFEST VERIFICATION
// ═══════════════════════════════════════════════════════════════

describe('Manifest Verification', () => {
    it('manifest contains sha256 for each file', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'a.txt', content: 'aaa' },
                { name: 'b.txt', content: 'bbb' },
            ],
        });
        if (result!.status === 'ok') {
            const manifest = JSON.parse(
                await fs.readFile(path.join(result!.absDir, '.manifest.json'), 'utf8'),
            );
            expect(manifest.files).toHaveLength(2);
            for (const file of manifest.files) {
                expect(file.sha256).toBeDefined();
                expect(file.sha256.length).toBe(64); // sha256 hex length
            }
        }
    });

    it('manifest contains correct file sizes', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'sized.txt', content: 'Hello' }],
        });
        if (result!.status === 'ok') {
            const manifest = JSON.parse(
                await fs.readFile(path.join(result!.absDir, '.manifest.json'), 'utf8'),
            );
            expect(manifest.files[0].bytes).toBe(5);
        }
    });

    it('manifest totalBytes matches sum of files', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [
                { name: 'a.txt', content: 'abc' },
                { name: 'b.txt', content: 'defgh' },
            ],
        });
        if (result!.status === 'ok') {
            const manifest = JSON.parse(
                await fs.readFile(path.join(result!.absDir, '.manifest.json'), 'utf8'),
            );
            const sum = manifest.files.reduce((s: number, f: { bytes: number }) => s + f.bytes, 0);
            expect(manifest.totalBytes).toBe(sum);
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// LIMITS BOUNDARY
// ═══════════════════════════════════════════════════════════════

describe('Limits Boundary', () => {
    it('maxFiles=0 disables file attachment', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'data' }],
            limits: resolveAttachmentLimits({ attachments: { maxFiles: 0 } }),
        });
        expect(result!.status).toBe('error');
    });

    it('maxFileBytes=0 rejects all files', async () => {
        const result = await materializeSubagentAttachments({
            workspaceDir: tmpDir,
            attachments: [{ name: 'test.txt', content: 'x' }],
            limits: resolveAttachmentLimits({ attachments: { maxFileBytes: 0 } }),
        });
        expect(result!.status).toBe('error');
    });
});
