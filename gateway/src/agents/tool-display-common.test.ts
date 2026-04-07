/**
 * Tests for CoreBlow Tool Display Utilities
 */

import { describe, it, expect } from 'vitest';
import {
    truncateOutput,
    formatToolResult,
    formatFilePreview,
    formatDiff,
    formatProgress,
    renderProgressBar,
    formatDuration,
    formatFileSize,
    inferLanguage,
    getFileLanguage,
    formatTable,
    formatKeyValue,
} from './tool-display-common.js';

describe('truncateOutput', () => {
    it('should not truncate short output', () => {
        const result = truncateOutput('hello world', 100);
        expect(result.truncated).toBe(false);
        expect(result.text).toBe('hello world');
    });

    it('should truncate at end by default', () => {
        const long = 'a'.repeat(200);
        const result = truncateOutput(long, 100);
        expect(result.truncated).toBe(true);
        expect(result.text.length).toBeLessThan(long.length);
        expect(result.text).toContain('truncated');
    });

    it('should truncate in middle when specified', () => {
        const long = 'a'.repeat(200);
        const result = truncateOutput(long, 100, 'middle');
        expect(result.truncated).toBe(true);
        expect(result.text).toContain('omitted');
    });

    it('should track original length', () => {
        const result = truncateOutput('a'.repeat(200), 100);
        expect(result.originalLength).toBe(200);
    });
});

describe('formatToolResult', () => {
    it('should format successful result', () => {
        const result = formatToolResult({
            toolName: 'exec',
            output: 'file1.txt\nfile2.txt',
            durationMs: 150,
        });
        expect(result).toContain('✅');
        expect(result).toContain('exec');
        expect(result).toContain('file1.txt');
    });

    it('should format error result', () => {
        const result = formatToolResult({
            toolName: 'exec',
            output: '',
            error: 'command not found',
            durationMs: 50,
        });
        expect(result).toContain('❌');
        expect(result).toContain('command not found');
    });

    it('should show exit code', () => {
        const result = formatToolResult({
            toolName: 'exec',
            output: '',
            durationMs: 100,
            exitCode: 1,
        });
        expect(result).toContain('Exit code: 1');
    });
});

describe('formatFilePreview', () => {
    it('should format file with line numbers', () => {
        const result = formatFilePreview({
            path: 'src/index.ts',
            language: 'typescript',
            content: 'const x = 1;\nconst y = 2;',
            startLine: 1,
            endLine: 2,
            totalLines: 100,
            truncated: false,
        });
        expect(result).toContain('src/index.ts');
        expect(result).toContain('typescript');
        expect(result).toContain('const x');
    });

    it('should indicate truncation', () => {
        const result = formatFilePreview({
            path: 'big.ts',
            language: 'typescript',
            content: 'line',
            totalLines: 1000,
            truncated: true,
        });
        expect(result).toContain('truncated');
    });
});

describe('formatDiff', () => {
    it('should format diff block', () => {
        const result = formatDiff({
            path: 'src/file.ts',
            hunks: [{
                oldStart: 1, oldCount: 3, newStart: 1, newCount: 3,
                lines: [
                    { type: 'context', content: 'const a = 1;' },
                    { type: 'remove', content: 'const b = 2;' },
                    { type: 'add', content: 'const b = 3;' },
                ],
            }],
            additions: 1,
            deletions: 1,
        });
        expect(result).toContain('+1 -1');
        expect(result).toContain('-const b = 2;');
        expect(result).toContain('+const b = 3;');
    });
});

describe('formatProgress', () => {
    it('should format progress indicator', () => {
        const result = formatProgress({
            label: 'Installing',
            current: 5,
            total: 10,
            startedAt: Date.now() - 5000,
            status: 'running',
        });
        expect(result).toContain('⏳');
        expect(result).toContain('50%');
        expect(result).toContain('5/10');
    });

    it('should show complete icon', () => {
        const result = formatProgress({
            label: 'Done',
            current: 10,
            total: 10,
            startedAt: Date.now(),
            status: 'complete',
        });
        expect(result).toContain('✅');
    });
});

describe('renderProgressBar', () => {
    it('should render progress bar', () => {
        expect(renderProgressBar(50, 10)).toContain('█████');
        expect(renderProgressBar(0, 10)).toBe('[░░░░░░░░░░]');
        expect(renderProgressBar(100, 10)).toBe('[██████████]');
    });
});

describe('formatDuration', () => {
    it('should format milliseconds', () => {
        expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
        expect(formatDuration(2500)).toBe('2.5s');
    });

    it('should format minutes', () => {
        expect(formatDuration(125000)).toBe('2m 5s');
    });
});

describe('formatFileSize', () => {
    it('should format bytes', () => {
        expect(formatFileSize(500)).toBe('500 B');
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(1_500_000)).toBe('1.4 MB');
    });
});

describe('inferLanguage', () => {
    it('should infer bash for exec tool', () => {
        expect(inferLanguage('exec', 'ls output')).toBe('bash');
    });

    it('should infer json from content', () => {
        expect(inferLanguage('read', '{"key": "value"}')).toBe('json');
    });
});

describe('getFileLanguage', () => {
    it('should detect by extension', () => {
        expect(getFileLanguage('file.ts')).toBe('typescript');
        expect(getFileLanguage('file.py')).toBe('python');
        expect(getFileLanguage('file.rs')).toBe('rust');
        expect(getFileLanguage('file.go')).toBe('go');
    });

    it('should return empty for unknown', () => {
        expect(getFileLanguage('file.xyz')).toBe('');
    });
});

describe('formatTable', () => {
    it('should format markdown table', () => {
        const result = formatTable(
            ['Name', 'Value'],
            [['key1', 'val1'], ['key2', 'val2']],
        );
        expect(result).toContain('| Name');
        expect(result).toContain('| key1');
        expect(result).toContain('---');
    });

    it('should return empty for no data', () => {
        expect(formatTable([], [])).toBe('');
    });
});

describe('formatKeyValue', () => {
    it('should format key-value pairs', () => {
        const result = formatKeyValue([['Name', 'Test'], ['Status', 'OK']]);
        expect(result).toContain('Name   : Test');
        expect(result).toContain('Status : OK');
    });
});
