/**
 * Tests for CoreBlow Agent Scope Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    registerAgentConfig,
    getAgentConfig,
    listAgentConfigs,
    removeAgentConfig,
    clearAgentConfigs,
    normalizeAgentId,
    isValidAgentId,
    resolveAgentConfig,
    resolveAgentEffectiveModelPrimary,
    resolveAgentModelFallbacksOverride,
    resolveAgentToolPolicy,
    isToolAllowedForAgent,
    resolveAgentScope,
    mergeAgentConfigs,
    validateAgentConfig,
    type AgentConfig,
} from './agent-scope.js';

describe('normalizeAgentId', () => {
    it('should lowercase and trim', () => {
        expect(normalizeAgentId('  MyAgent  ')).toBe('myagent');
    });

    it('should replace spaces with hyphens', () => {
        expect(normalizeAgentId('My Cool Agent')).toBe('my-cool-agent');
    });
});

describe('isValidAgentId', () => {
    it('should accept valid IDs', () => {
        expect(isValidAgentId('my-agent')).toBe(true);
        expect(isValidAgentId('agent-01')).toBe(true);
        expect(isValidAgentId('default')).toBe(true);
    });

    it('should reject invalid IDs', () => {
        expect(isValidAgentId('')).toBe(false);
        expect(isValidAgentId('-invalid')).toBe(false);
    });
});

describe('Agent Config Registry', () => {
    beforeEach(() => {
        clearAgentConfigs();
    });

    it('should register and retrieve configs', () => {
        const config: AgentConfig = { name: 'Test Agent', model: 'openai/gpt-4o' };
        registerAgentConfig('test-agent', config);
        expect(getAgentConfig('test-agent')).toEqual(config);
    });

    it('should normalize IDs on register/get', () => {
        registerAgentConfig('  My Agent  ', { name: 'Test' });
        expect(getAgentConfig('my-agent')).toBeDefined();
    });

    it('should list all configs', () => {
        registerAgentConfig('agent-1', { name: 'Agent 1' });
        registerAgentConfig('agent-2', { name: 'Agent 2' });
        expect(listAgentConfigs()).toHaveLength(2);
    });

    it('should remove configs', () => {
        registerAgentConfig('test', { name: 'Test' });
        expect(removeAgentConfig('test')).toBe(true);
        expect(getAgentConfig('test')).toBeUndefined();
    });

    it('should clear all configs', () => {
        registerAgentConfig('a', { name: 'A' });
        registerAgentConfig('b', { name: 'B' });
        clearAgentConfigs();
        expect(listAgentConfigs()).toHaveLength(0);
    });
});

describe('resolveAgentEffectiveModelPrimary', () => {
    beforeEach(() => clearAgentConfigs());

    it('should resolve string model', () => {
        registerAgentConfig('test', { model: 'openai/gpt-4o' });
        const result = resolveAgentEffectiveModelPrimary({}, 'test');
        expect(result).toBe('openai/gpt-4o');
    });

    it('should resolve object model with primary', () => {
        registerAgentConfig('test', { model: { primary: 'anthropic/claude-opus-4-6' } });
        const result = resolveAgentEffectiveModelPrimary({}, 'test');
        expect(result).toBe('anthropic/claude-opus-4-6');
    });

    it('should return undefined for no model', () => {
        registerAgentConfig('test', { name: 'Test' });
        const result = resolveAgentEffectiveModelPrimary({}, 'test');
        expect(result).toBeUndefined();
    });
});

describe('resolveAgentModelFallbacksOverride', () => {
    beforeEach(() => clearAgentConfigs());

    it('should resolve fallback array', () => {
        registerAgentConfig('test', {
            model: { primary: 'openai/gpt-4o', fallback: ['anthropic/claude-sonnet-4-5'] },
        });
        const result = resolveAgentModelFallbacksOverride({}, 'test');
        expect(result).toEqual(['anthropic/claude-sonnet-4-5']);
    });

    it('should return undefined for no fallbacks', () => {
        registerAgentConfig('test', { model: 'openai/gpt-4o' });
        const result = resolveAgentModelFallbacksOverride({}, 'test');
        expect(result).toBeUndefined();
    });
});

describe('resolveAgentToolPolicy', () => {
    beforeEach(() => clearAgentConfigs());

    it('should return default policy when no tools configured', () => {
        registerAgentConfig('test', { name: 'Test' });
        const policy = resolveAgentToolPolicy({}, 'test');
        expect(policy.allow).toEqual(['*']);
        expect(policy.deny).toEqual([]);
    });

    it('should return configured policy', () => {
        registerAgentConfig('test', {
            tools: { allow: ['read', 'write'], deny: ['exec'] },
        });
        const policy = resolveAgentToolPolicy({}, 'test');
        expect(policy.allow).toEqual(['read', 'write']);
        expect(policy.deny).toEqual(['exec']);
    });
});

describe('isToolAllowedForAgent', () => {
    beforeEach(() => clearAgentConfigs());

    it('should allow all tools with wildcard', () => {
        registerAgentConfig('test', { name: 'Test' });
        expect(isToolAllowedForAgent({}, 'test', 'read')).toBe(true);
        expect(isToolAllowedForAgent({}, 'test', 'exec')).toBe(true);
    });

    it('should deny specific tools', () => {
        registerAgentConfig('test', {
            tools: { allow: ['*'], deny: ['exec'] },
        });
        expect(isToolAllowedForAgent({}, 'test', 'read')).toBe(true);
        expect(isToolAllowedForAgent({}, 'test', 'exec')).toBe(false);
    });
});

describe('resolveAgentScope', () => {
    beforeEach(() => clearAgentConfigs());

    it('should resolve full scope', () => {
        registerAgentConfig('test-agent', {
            name: 'Test',
            model: 'openai/gpt-4o',
            tools: { allow: ['read', 'write'], deny: [] },
        });

        const scope = resolveAgentScope({}, 'test-agent');
        expect(scope.agentId).toBe('test-agent');
        expect(scope.resolvedModel).toBe('openai/gpt-4o');
        expect(scope.effectiveTools.allow).toEqual(['read', 'write']);
    });

    it('should handle unknown agent', () => {
        const scope = resolveAgentScope({}, 'unknown');
        expect(scope.agentId).toBe('unknown');
        expect(scope.resolvedModel).toBeUndefined();
    });
});

describe('mergeAgentConfigs', () => {
    it('should merge configs with override winning', () => {
        const base: AgentConfig = { name: 'Base', model: 'openai/gpt-4o', temperature: 0.7 };
        const override: AgentConfig = { name: 'Override', temperature: 0.3 };
        const merged = mergeAgentConfigs(base, override);
        expect(merged.name).toBe('Override');
        expect(merged.model).toBe('openai/gpt-4o');
        expect(merged.temperature).toBe(0.3);
    });

    it('should merge metadata deeply', () => {
        const base: AgentConfig = { metadata: { a: 1, b: 2 } };
        const override: AgentConfig = { metadata: { b: 3, c: 4 } };
        const merged = mergeAgentConfigs(base, override);
        expect(merged.metadata).toEqual({ a: 1, b: 3, c: 4 });
    });
});

describe('validateAgentConfig', () => {
    it('should accept valid config', () => {
        const result = validateAgentConfig({ name: 'Valid', temperature: 0.7, maxContextTokens: 8192 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid temperature', () => {
        const result = validateAgentConfig({ temperature: 3.0 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('temperature must be between 0 and 2');
    });

    it('should reject negative maxContextTokens', () => {
        const result = validateAgentConfig({ maxContextTokens: -1 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('maxContextTokens must be positive');
    });
});
