/**
 * C5 Tests: Subagent Depth & Capabilities (Parity with CoreBlow depth.test.ts)
 */
import { describe, it, expect } from 'vitest';
import {
    getSubagentDepthFromKey,
    isSubagentSessionKey,
    extractSubagentSegments,
    parseSubagentDepthFromSegments,
    isSubagentKeyStrictFormat,
} from '../../src/agents/subagent/subagent-depth.js';
import {
    resolveSubagentCapabilities,
    resolveStoredSubagentCapabilities,
    DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH,
    type SubagentCapabilities,
} from '../../src/agents/subagent/subagent-capabilities.js';

// ═══════════════════════════════════════════════════════════════
// DEPTH PARSING
// ═══════════════════════════════════════════════════════════════

describe('Depth Parsing', () => {
    it('returns 0 for main session keys', () => {
        expect(getSubagentDepthFromKey('agent:default:main')).toBe(0);
        expect(getSubagentDepthFromKey('agent:mybot:main')).toBe(0);
    });

    it('returns 1 for direct subagent', () => {
        expect(getSubagentDepthFromKey('agent:default:sub:0:child')).toBe(1);
        expect(getSubagentDepthFromKey('agent:main:subagent:abc123')).toBe(1);
    });

    it('returns 2 for nested subagent', () => {
        expect(getSubagentDepthFromKey('agent:default:sub:0:sub:1:child')).toBe(2);
    });

    it('returns 3 for deeply nested subagent', () => {
        expect(getSubagentDepthFromKey('agent:default:sub:0:sub:1:sub:2:child')).toBe(3);
    });

    it('returns 0 for empty or undefined', () => {
        expect(getSubagentDepthFromKey('')).toBe(0);
        expect(getSubagentDepthFromKey(undefined as unknown as string)).toBe(0);
    });

    it('handles malformed keys gracefully', () => {
        expect(getSubagentDepthFromKey('random-string')).toBe(0);
        expect(getSubagentDepthFromKey('agent:')).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// SUBAGENT KEY DETECTION
// ═══════════════════════════════════════════════════════════════

describe('Subagent Key Detection', () => {
    it('identifies subagent session keys', () => {
        expect(isSubagentSessionKey('agent:default:sub:0:child')).toBe(true);
        expect(isSubagentSessionKey('agent:main:subagent:abc')).toBe(true);
    });

    it('rejects non-subagent keys', () => {
        expect(isSubagentSessionKey('agent:default:main')).toBe(false);
        expect(isSubagentSessionKey('')).toBe(false);
        expect(isSubagentSessionKey('something:else')).toBe(false);
    });

    it('strict format checks exact patterns', () => {
        expect(isSubagentKeyStrictFormat('agent:default:subagent:abc-123')).toBe(true);
        expect(isSubagentKeyStrictFormat('agent:default:sub:0:child')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// SEGMENT EXTRACTION
// ═══════════════════════════════════════════════════════════════

describe('Segment Extraction', () => {
    it('extracts sub segments from key', () => {
        const segments = extractSubagentSegments('agent:default:sub:0:sub:1:child');
        expect(segments).toBeDefined();
        expect(segments!.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty for non-subagent keys', () => {
        const segments = extractSubagentSegments('agent:default:main');
        expect(segments).toBeDefined();
    });

    it('parseSubagentDepthFromSegments counts correctly', () => {
        const depth = parseSubagentDepthFromSegments(['sub', '0', 'sub', '1', 'child']);
        expect(depth).toBe(2);
    });

    it('parseSubagentDepthFromSegments handles empty', () => {
        expect(parseSubagentDepthFromSegments([])).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// CAPABILITIES
// ═══════════════════════════════════════════════════════════════

describe('Capabilities Resolution', () => {
    it('depth 0 is main with children scope', () => {
        const caps = resolveSubagentCapabilities({ depth: 0, maxSpawnDepth: 3 });
        expect(caps.role).toBe('main');
        expect(caps.controlScope).toBe('children');
        expect(caps.canSpawn).toBe(true);
    });

    it('depth 1 is orchestrator with children scope', () => {
        const caps = resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: 3 });
        expect(caps.role).toBe('orchestrator');
        expect(caps.controlScope).toBe('children');
        expect(caps.canSpawn).toBe(true);
    });

    it('depth at max is leaf with none scope', () => {
        const caps = resolveSubagentCapabilities({ depth: 3, maxSpawnDepth: 3 });
        expect(caps.role).toBe('leaf');
        expect(caps.controlScope).toBe('none');
        expect(caps.canSpawn).toBe(false);
    });

    it('depth beyond max is leaf', () => {
        const caps = resolveSubagentCapabilities({ depth: 5, maxSpawnDepth: 3 });
        expect(caps.role).toBe('leaf');
        expect(caps.canSpawn).toBe(false);
    });

    it('DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH is a reasonable value', () => {
        expect(DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH).toBeGreaterThanOrEqual(2);
        expect(DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH).toBeLessThanOrEqual(10);
    });

    it('resolveStoredSubagentCapabilities resolves from session key', () => {
        const caps = resolveStoredSubagentCapabilities('agent:default:sub:0:child');
        expect(caps).toBeDefined();
        expect(caps.role).not.toBe('main');
    });

    it('resolveStoredSubagentCapabilities resolves main for non-subagent', () => {
        const caps = resolveStoredSubagentCapabilities('agent:default:main');
        expect(caps.role).toBe('main');
    });
});

// ═══════════════════════════════════════════════════════════════
// DEPTH EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Depth Edge Cases', () => {
    it('handles keys with UUID subagent format', () => {
        const depth = getSubagentDepthFromKey('agent:default:subagent:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        expect(depth).toBe(1);
    });

    it('handles keys with multiple subagent segments', () => {
        const key = 'agent:default:subagent:first:subagent:second';
        const depth = getSubagentDepthFromKey(key);
        expect(depth).toBeGreaterThanOrEqual(1);
    });

    it('capabilities degrade gracefully with negative depth', () => {
        const caps = resolveSubagentCapabilities({ depth: -1, maxSpawnDepth: 3 });
        expect(caps.role).toBe('main');
        expect(caps.canSpawn).toBe(true);
    });

    it('zero max spawn depth prevents all spawning beyond main', () => {
        const caps = resolveSubagentCapabilities({ depth: 0, maxSpawnDepth: 0 });
        expect(caps.canSpawn).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// ROLE RESOLUTION — DETAILED
// ═══════════════════════════════════════════════════════════════

import {
    resolveSubagentRoleForDepth,
    resolveSubagentControlScopeForRole,
    SUBAGENT_SESSION_ROLES,
    SUBAGENT_CONTROL_SCOPES,
} from '../../src/agents/subagent/subagent-capabilities.js';

describe('resolveSubagentRoleForDepth', () => {
    it('depth 0 with default max is main', () => {
        expect(resolveSubagentRoleForDepth({ depth: 0 })).toBe('main');
    });

    it('depth 0 with maxSpawnDepth 0 is leaf', () => {
        expect(resolveSubagentRoleForDepth({ depth: 0, maxSpawnDepth: 0 })).toBe('leaf');
    });

    it('depth 1 with max 3 is orchestrator', () => {
        expect(resolveSubagentRoleForDepth({ depth: 1, maxSpawnDepth: 3 })).toBe('orchestrator');
    });

    it('depth 2 with max 3 is orchestrator', () => {
        expect(resolveSubagentRoleForDepth({ depth: 2, maxSpawnDepth: 3 })).toBe('orchestrator');
    });

    it('depth 3 with max 3 is leaf', () => {
        expect(resolveSubagentRoleForDepth({ depth: 3, maxSpawnDepth: 3 })).toBe('leaf');
    });

    it('depth > max is leaf', () => {
        expect(resolveSubagentRoleForDepth({ depth: 10, maxSpawnDepth: 3 })).toBe('leaf');
    });

    it('negative depth treated as 0 (main)', () => {
        expect(resolveSubagentRoleForDepth({ depth: -5, maxSpawnDepth: 3 })).toBe('main');
    });

    it('NaN depth treated as 0 (main)', () => {
        expect(resolveSubagentRoleForDepth({ depth: NaN, maxSpawnDepth: 3 })).toBe('main');
    });

    it('float depth floored', () => {
        // 1.9 is not an integer, treated as 0
        expect(resolveSubagentRoleForDepth({ depth: 1.9, maxSpawnDepth: 3 })).toBe('main');
    });

    it('negative maxSpawnDepth treated as 0 (leaf)', () => {
        expect(resolveSubagentRoleForDepth({ depth: 0, maxSpawnDepth: -1 })).toBe('leaf');
    });

    it('NaN maxSpawnDepth uses default', () => {
        expect(resolveSubagentRoleForDepth({ depth: 0, maxSpawnDepth: NaN })).toBe('main');
    });

    it('Infinity maxSpawnDepth uses default', () => {
        expect(resolveSubagentRoleForDepth({ depth: 0, maxSpawnDepth: Infinity })).toBe('main');
    });

    it('undefined maxSpawnDepth uses default', () => {
        expect(resolveSubagentRoleForDepth({ depth: 1 })).toBe('orchestrator');
    });

    it('maxSpawnDepth 1 makes depth 1 a leaf', () => {
        expect(resolveSubagentRoleForDepth({ depth: 1, maxSpawnDepth: 1 })).toBe('leaf');
    });
});

describe('resolveSubagentControlScopeForRole', () => {
    it('main has children scope', () => {
        expect(resolveSubagentControlScopeForRole('main')).toBe('children');
    });

    it('orchestrator has children scope', () => {
        expect(resolveSubagentControlScopeForRole('orchestrator')).toBe('children');
    });

    it('leaf has none scope', () => {
        expect(resolveSubagentControlScopeForRole('leaf')).toBe('none');
    });
});

// ═══════════════════════════════════════════════════════════════
// CAPABILITIES — canControlChildren
// ═══════════════════════════════════════════════════════════════

describe('Capabilities — canControlChildren', () => {
    it('main can control children', () => {
        const caps = resolveSubagentCapabilities({ depth: 0, maxSpawnDepth: 3 });
        expect(caps.canControlChildren).toBe(true);
    });

    it('orchestrator can control children', () => {
        const caps = resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: 3 });
        expect(caps.canControlChildren).toBe(true);
    });

    it('leaf cannot control children', () => {
        const caps = resolveSubagentCapabilities({ depth: 3, maxSpawnDepth: 3 });
        expect(caps.canControlChildren).toBe(false);
    });

    it('depth field is normalized', () => {
        const caps = resolveSubagentCapabilities({ depth: -5, maxSpawnDepth: 3 });
        expect(caps.depth).toBe(0);
    });

    it('depth field is floored', () => {
        const caps = resolveSubagentCapabilities({ depth: 2.7, maxSpawnDepth: 3 });
        expect(caps.depth).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// STORED CAPABILITIES — SESSION STORE
// ═══════════════════════════════════════════════════════════════

describe('Stored Capabilities — Session Store', () => {
    it('resolves from store with explicit role', () => {
        const caps = resolveStoredSubagentCapabilities(
            'agent:default:subagent:abc',
            {
                store: {
                    'agent:default:subagent:abc': {
                        subagentRole: 'leaf',
                        subagentControlScope: 'none',
                        spawnDepth: 2,
                    },
                },
            },
        );
        expect(caps.role).toBe('leaf');
        expect(caps.controlScope).toBe('none');
    });

    it('falls back to computed when store has no match', () => {
        const caps = resolveStoredSubagentCapabilities(
            'agent:default:subagent:xyz',
            { store: {} },
        );
        expect(caps.role).toBeDefined();
    });

    it('handles null session key', () => {
        const caps = resolveStoredSubagentCapabilities(null);
        expect(caps.role).toBe('main');
    });

    it('handles undefined session key', () => {
        const caps = resolveStoredSubagentCapabilities(undefined);
        expect(caps.role).toBe('main');
    });

    it('handles whitespace-only session key', () => {
        const caps = resolveStoredSubagentCapabilities('   ');
        expect(caps.role).toBe('main');
    });

    it('uses custom maxSpawnDepth from opts', () => {
        const caps = resolveStoredSubagentCapabilities(
            'agent:default:subagent:deep',
            { maxSpawnDepth: 1 },
        );
        expect(caps).toBeDefined();
    });

    it('normalizes invalid stored role', () => {
        const caps = resolveStoredSubagentCapabilities(
            'agent:default:subagent:abc',
            {
                store: {
                    'agent:default:subagent:abc': {
                        subagentRole: 'invalid_role',
                    },
                },
            },
        );
        // Should fall back to computed role
        expect(SUBAGENT_SESSION_ROLES).toContain(caps.role);
    });

    it('normalizes invalid stored controlScope', () => {
        const caps = resolveStoredSubagentCapabilities(
            'agent:default:subagent:abc',
            {
                store: {
                    'agent:default:subagent:abc': {
                        subagentControlScope: 'bad_scope',
                    },
                },
            },
        );
        expect(SUBAGENT_CONTROL_SCOPES).toContain(caps.controlScope);
    });
});

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

describe('Constants', () => {
    it('SUBAGENT_SESSION_ROLES has correct values', () => {
        expect(SUBAGENT_SESSION_ROLES).toEqual(['main', 'orchestrator', 'leaf']);
    });

    it('SUBAGENT_CONTROL_SCOPES has correct values', () => {
        expect(SUBAGENT_CONTROL_SCOPES).toEqual(['children', 'none']);
    });
});

// ═══════════════════════════════════════════════════════════════
// DEPTH — ADDITIONAL SUBAGENT KEY PATTERNS
// ═══════════════════════════════════════════════════════════════

describe('Depth — Additional Key Patterns', () => {
    it('recognizes agent:X:subagent:Y format', () => {
        expect(isSubagentSessionKey('agent:mybot:subagent:abc123')).toBe(true);
    });

    it('recognizes agent:X:sub:N:Y format', () => {
        expect(isSubagentSessionKey('agent:default:sub:0:worker')).toBe(true);
    });

    it('rejects empty key', () => {
        expect(isSubagentSessionKey('')).toBe(false);
    });

    it('handles numeric-only post-sub segments', () => {
        const depth = getSubagentDepthFromKey('agent:default:sub:0:sub:1:sub:2:end');
        expect(depth).toBe(3);
    });

    it('extractSubagentSegments handles complex key', () => {
        const segments = extractSubagentSegments('agent:default:sub:0:sub:1:worker');
        expect(segments).toBeDefined();
    });

    it('parseSubagentDepthFromSegments with single sub', () => {
        expect(parseSubagentDepthFromSegments(['sub', '0', 'worker'])).toBe(1);
    });

    it('parseSubagentDepthFromSegments with zero subs', () => {
        expect(parseSubagentDepthFromSegments(['main'])).toBe(0);
    });

    it('parseSubagentDepthFromSegments with subagent segment', () => {
        expect(parseSubagentDepthFromSegments(['subagent', 'abc123'])).toBeGreaterThanOrEqual(0);
    });

    it('isSubagentKeyStrictFormat with valid patterns', () => {
        expect(isSubagentKeyStrictFormat('agent:default:subagent:abc-123')).toBe(true);
        expect(isSubagentKeyStrictFormat('agent:bot:sub:0:worker')).toBe(true);
    });

    it('isSubagentKeyStrictFormat rejects main session', () => {
        expect(isSubagentKeyStrictFormat('agent:default:main')).toBe(false);
    });

    it('getSubagentDepthFromKey is consistent across formats', () => {
        const depth1 = getSubagentDepthFromKey('agent:default:sub:0:child');
        const depth2 = getSubagentDepthFromKey('agent:main:subagent:abc123');
        expect(depth1).toBe(1);
        expect(depth2).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════
// CAPABILITIES — FULL MATRIX
// ═══════════════════════════════════════════════════════════════

describe('Capabilities — Full Matrix', () => {
    const maxDepth = 4;

    it('depth 0: main, children, canSpawn=true', () => {
        const c = resolveSubagentCapabilities({ depth: 0, maxSpawnDepth: maxDepth });
        expect(c).toEqual({
            depth: 0,
            role: 'main',
            controlScope: 'children',
            canSpawn: true,
            canControlChildren: true,
        });
    });

    it('depth 1: orchestrator, children, canSpawn=true', () => {
        const c = resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: maxDepth });
        expect(c.role).toBe('orchestrator');
        expect(c.canSpawn).toBe(true);
        expect(c.canControlChildren).toBe(true);
    });

    it('depth maxDepth-1: orchestrator, children, canSpawn=true', () => {
        const c = resolveSubagentCapabilities({ depth: maxDepth - 1, maxSpawnDepth: maxDepth });
        expect(c.role).toBe('orchestrator');
        expect(c.canSpawn).toBe(true);
    });

    it('depth maxDepth: leaf, none, canSpawn=false', () => {
        const c = resolveSubagentCapabilities({ depth: maxDepth, maxSpawnDepth: maxDepth });
        expect(c.role).toBe('leaf');
        expect(c.canSpawn).toBe(false);
        expect(c.canControlChildren).toBe(false);
    });

    it('all roles are in SUBAGENT_SESSION_ROLES', () => {
        for (let d = 0; d <= maxDepth + 1; d++) {
            const c = resolveSubagentCapabilities({ depth: d, maxSpawnDepth: maxDepth });
            expect(SUBAGENT_SESSION_ROLES).toContain(c.role);
        }
    });

    it('all scopes are in SUBAGENT_CONTROL_SCOPES', () => {
        for (let d = 0; d <= maxDepth + 1; d++) {
            const c = resolveSubagentCapabilities({ depth: d, maxSpawnDepth: maxDepth });
            expect(SUBAGENT_CONTROL_SCOPES).toContain(c.controlScope);
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// NEW CAPABILITY HELPERS
// ═══════════════════════════════════════════════════════════════

import {
    canSpawnAtDepth,
    describeCapabilities,
    getMaxChildrenForRole,
    isSpawnAllowed,
} from '../../src/agents/subagent/subagent-capabilities.js';

describe('canSpawnAtDepth', () => {
    it('depth 0 can spawn with default maxDepth', () => {
        expect(canSpawnAtDepth(0)).toBe(true);
    });

    it('depth 1 can spawn (orchestrator)', () => {
        expect(canSpawnAtDepth(1)).toBe(true);
    });

    it('depth at maxSpawnDepth cannot spawn (leaf)', () => {
        expect(canSpawnAtDepth(3, 3)).toBe(false);
    });

    it('depth beyond maxSpawnDepth cannot spawn', () => {
        expect(canSpawnAtDepth(10, 3)).toBe(false);
    });

    it('maxSpawnDepth 0 means even depth 0 is leaf', () => {
        expect(canSpawnAtDepth(0, 0)).toBe(false);
    });

    it('maxSpawnDepth 1 allows only depth 0 (main)', () => {
        expect(canSpawnAtDepth(0, 1)).toBe(true);
        expect(canSpawnAtDepth(1, 1)).toBe(false);
    });

    it('negative depth treated as 0', () => {
        expect(canSpawnAtDepth(-5)).toBe(true);
    });
});

describe('describeCapabilities', () => {
    it('describes main capabilities', () => {
        const caps = resolveSubagentCapabilities({ depth: 0 });
        const desc = describeCapabilities(caps);
        expect(desc).toContain('main');
        expect(desc).toContain('Spawn: yes');
        expect(desc).toContain('Control: yes');
    });

    it('describes orchestrator capabilities', () => {
        const caps = resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: 3 });
        const desc = describeCapabilities(caps);
        expect(desc).toContain('orchestrator');
        expect(desc).toContain('Spawn: yes');
    });

    it('describes leaf capabilities', () => {
        const caps = resolveSubagentCapabilities({ depth: 3, maxSpawnDepth: 3 });
        const desc = describeCapabilities(caps);
        expect(desc).toContain('leaf');
        expect(desc).toContain('Spawn: no');
        expect(desc).toContain('Control: no');
    });

    it('includes depth in description', () => {
        const caps = resolveSubagentCapabilities({ depth: 2 });
        const desc = describeCapabilities(caps);
        expect(desc).toContain('Depth: 2');
    });

    it('includes control scope in description', () => {
        const caps = resolveSubagentCapabilities({ depth: 0 });
        const desc = describeCapabilities(caps);
        expect(desc).toContain('Scope: children');
    });
});

describe('getMaxChildrenForRole', () => {
    it('main allows 10 children', () => {
        expect(getMaxChildrenForRole('main')).toBe(10);
    });

    it('orchestrator allows 5 children', () => {
        expect(getMaxChildrenForRole('orchestrator')).toBe(5);
    });

    it('leaf allows 0 children', () => {
        expect(getMaxChildrenForRole('leaf')).toBe(0);
    });
});

describe('isSpawnAllowed', () => {
    it('allows spawn at depth 0 with no children', () => {
        const result = isSpawnAllowed({ depth: 0, activeChildren: 0 });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('blocks spawn at leaf depth', () => {
        const result = isSpawnAllowed({ depth: 3, activeChildren: 0, maxSpawnDepth: 3 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('leaf');
    });

    it('blocks spawn when max children reached', () => {
        const result = isSpawnAllowed({ depth: 0, activeChildren: 10 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Max children');
    });

    it('allows spawn below max children', () => {
        const result = isSpawnAllowed({ depth: 0, activeChildren: 9 });
        expect(result.allowed).toBe(true);
    });

    it('uses custom maxChildren override', () => {
        const result = isSpawnAllowed({ depth: 0, activeChildren: 2, maxChildren: 2 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('2/2');
    });

    it('orchestrator with max children reached', () => {
        const result = isSpawnAllowed({ depth: 1, activeChildren: 5, maxSpawnDepth: 3 });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('5/5');
    });

    it('orchestrator with children below limit', () => {
        const result = isSpawnAllowed({ depth: 1, activeChildren: 3, maxSpawnDepth: 3 });
        expect(result.allowed).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// STORED CAPABILITIES EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('resolveStoredSubagentCapabilities Edge Cases', () => {
    it('null session key falls back to default', () => {
        const caps = resolveStoredSubagentCapabilities(null);
        expect(caps.depth).toBe(0);
        expect(caps.role).toBe('main');
    });

    it('empty string session key falls back to default', () => {
        const caps = resolveStoredSubagentCapabilities('');
        expect(caps.depth).toBe(0);
        expect(caps.role).toBe('main');
    });

    it('whitespace-only session key falls back to default', () => {
        const caps = resolveStoredSubagentCapabilities('   ');
        expect(caps.depth).toBe(0);
        expect(caps.role).toBe('main');
    });

    it('non-subagent session key uses depth resolution', () => {
        const caps = resolveStoredSubagentCapabilities('agent:some:session');
        expect(caps.depth).toBe(0);
    });

    it('subagent session key with store override', () => {
        const store = {
            'agent:default:subagent:test': {
                subagentRole: 'leaf',
                subagentControlScope: 'none',
            },
        };
        const caps = resolveStoredSubagentCapabilities('agent:default:subagent:test', { store });
        expect(caps.role).toBe('leaf');
        expect(caps.controlScope).toBe('none');
    });

    it('custom maxSpawnDepth overrides default', () => {
        const caps = resolveStoredSubagentCapabilities(null, { maxSpawnDepth: 1 });
        expect(caps.role).toBe('main');
    });
});

// ═══════════════════════════════════════════════════════════════
// DEPTH BOUNDARY CONDITIONS
// ═══════════════════════════════════════════════════════════════

describe('Depth Boundary Conditions', () => {
    it('very large depth is always leaf', () => {
        const caps = resolveSubagentCapabilities({ depth: 1000 });
        expect(caps.role).toBe('leaf');
        expect(caps.canSpawn).toBe(false);
    });

    it('fractional depth is floored', () => {
        const caps = resolveSubagentCapabilities({ depth: 1.9 });
        expect(caps.depth).toBe(1);
    });

    it('NaN depth treated as 0 for role resolution', () => {
        const caps = resolveSubagentCapabilities({ depth: NaN });
        // role uses isInteger check which falls back to 0
        expect(caps.role).toBe('main');
    });

    it('depth exactly one less than maxSpawnDepth is orchestrator', () => {
        const caps = resolveSubagentCapabilities({ depth: 2, maxSpawnDepth: 3 });
        expect(caps.role).toBe('orchestrator');
        expect(caps.canSpawn).toBe(true);
    });

    it('depth exactly at maxSpawnDepth is leaf', () => {
        const caps = resolveSubagentCapabilities({ depth: 3, maxSpawnDepth: 3 });
        expect(caps.role).toBe('leaf');
        expect(caps.canSpawn).toBe(false);
    });

    it('maxSpawnDepth of 1 gives main at 0, leaf at 1', () => {
        expect(resolveSubagentCapabilities({ depth: 0, maxSpawnDepth: 1 }).role).toBe('main');
        expect(resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: 1 }).role).toBe('leaf');
    });
});
