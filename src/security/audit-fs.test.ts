import { describe, it, expect } from 'vitest';
import { modeBits, formatOctal, isWorldWritable, isGroupWritable, isWorldReadable, isGroupReadable, formatPermissionDetail, formatPermissionRemediation } from './audit-fs.js';
import type { PermissionCheck } from './audit-fs.js';

describe('modeBits', () => {
    it('should extract lower 9 bits from mode', () => {
        expect(modeBits(0o100644)).toBe(0o644);
    });

    it('should return 777 from mode 0o100777', () => {
        expect(modeBits(0o100777)).toBe(0o777);
    });

    it('should return null for null input', () => {
        expect(modeBits(null)).toBeNull();
    });
});

describe('formatOctal', () => {
    it('should format 644 as "644"', () => {
        expect(formatOctal(0o644)).toBe('644');
    });

    it('should pad to 3 digits: 7 → "007"', () => {
        expect(formatOctal(0o7)).toBe('007');
    });

    it('should return "unknown" for null', () => {
        expect(formatOctal(null)).toBe('unknown');
    });
});

describe('isWorldWritable', () => {
    it('should return true for mode 777', () => {
        expect(isWorldWritable(0o777)).toBe(true);
    });

    it('should return true for mode 002', () => {
        expect(isWorldWritable(0o002)).toBe(true);
    });

    it('should return false for mode 644', () => {
        expect(isWorldWritable(0o644)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isWorldWritable(null)).toBe(false);
    });
});

describe('isGroupWritable', () => {
    it('should return true for mode 770', () => {
        expect(isGroupWritable(0o770)).toBe(true);
    });

    it('should return false for mode 700', () => {
        expect(isGroupWritable(0o700)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isGroupWritable(null)).toBe(false);
    });
});

describe('isWorldReadable', () => {
    it('should return true for mode 644', () => {
        expect(isWorldReadable(0o644)).toBe(true);
    });

    it('should return false for mode 600', () => {
        expect(isWorldReadable(0o600)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isWorldReadable(null)).toBe(false);
    });
});

describe('isGroupReadable', () => {
    it('should return true for mode 740', () => {
        expect(isGroupReadable(0o740)).toBe(true);
    });

    it('should return false for mode 700', () => {
        expect(isGroupReadable(0o700)).toBe(false);
    });

    it('should return false for null', () => {
        expect(isGroupReadable(null)).toBe(false);
    });
});

describe('formatPermissionDetail', () => {
    it('should format posix permission', () => {
        const perms: PermissionCheck = {
            ok: true, isSymlink: false, isDir: false, mode: 0o644, bits: 0o644,
            source: 'posix', worldWritable: false, groupWritable: false, worldReadable: true, groupReadable: true,
        };
        expect(formatPermissionDetail('/tmp/file', perms)).toBe('/tmp/file mode=644');
    });

    it('should format windows-acl permission', () => {
        const perms: PermissionCheck = {
            ok: true, isSymlink: false, isDir: false, mode: null, bits: null,
            source: 'windows-acl', worldWritable: false, groupWritable: false, worldReadable: false, groupReadable: false,
            aclSummary: 'BUILTIN\\Users:(R)',
        };
        expect(formatPermissionDetail('C:\\file', perms)).toContain('acl=BUILTIN\\Users:(R)');
    });
});

describe('formatPermissionRemediation', () => {
    it('should return chmod for posix', () => {
        const perms: PermissionCheck = {
            ok: true, isSymlink: false, isDir: false, mode: 0o777, bits: 0o777,
            source: 'posix', worldWritable: true, groupWritable: true, worldReadable: true, groupReadable: true,
        };
        const r = formatPermissionRemediation({ targetPath: '/tmp/file', perms, isDir: false, posixMode: 0o600 });
        expect(r).toBe('chmod 600 /tmp/file');
    });
});
