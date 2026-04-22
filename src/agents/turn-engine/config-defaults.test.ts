import { describe, it, expect } from 'vitest';
import {
    DEFAULT_AGENT_CONFIG,
    AGENT_LIMITS,
    DEFAULT_GATEWAY_CONFIG,
    DEFAULT_SANDBOX_CONFIG,
    DEFAULT_MODELS_CONFIG,
    createDefaultConfig,
} from './config/defaults.js';

describe('DEFAULT_AGENT_CONFIG', () => {
    it('has expected temperature', () => {
        expect(DEFAULT_AGENT_CONFIG.temperature).toBe(0.7);
    });

    it('has maxTokens', () => {
        expect(DEFAULT_AGENT_CONFIG.maxTokens).toBe(8192);
    });

    it('has timeout in seconds', () => {
        expect(DEFAULT_AGENT_CONFIG.timeout).toBe(300);
    });

    it('has maxTurns', () => {
        expect(DEFAULT_AGENT_CONFIG.maxTurns).toBe(25);
    });

    it('enables autoCompact', () => {
        expect(DEFAULT_AGENT_CONFIG.autoCompact).toBe(true);
    });
});

describe('AGENT_LIMITS', () => {
    it('has max context window', () => {
        expect(AGENT_LIMITS.maxContextWindow).toBe(2_000_000);
    });

    it('has temperature range', () => {
        expect(AGENT_LIMITS.minTemperature).toBe(0);
        expect(AGENT_LIMITS.maxTemperature).toBe(2);
    });

    it('has max turns', () => {
        expect(AGENT_LIMITS.maxTurns).toBe(100);
    });
});

describe('DEFAULT_GATEWAY_CONFIG', () => {
    it('has port 3577', () => {
        expect(DEFAULT_GATEWAY_CONFIG.port).toBe(3577);
    });

    it('binds to localhost', () => {
        expect(DEFAULT_GATEWAY_CONFIG.host).toBe('127.0.0.1');
    });
});

describe('DEFAULT_SANDBOX_CONFIG', () => {
    it('defaults mode to off', () => {
        expect(DEFAULT_SANDBOX_CONFIG.mode).toBe('off');
    });

    it('has sandbox image', () => {
        expect(DEFAULT_SANDBOX_CONFIG.image).toContain('coreblow');
    });

    it('has resource limits', () => {
        expect(DEFAULT_SANDBOX_CONFIG.cpus).toBe(2);
        expect(DEFAULT_SANDBOX_CONFIG.memoryMb).toBe(2048);
    });
});

describe('DEFAULT_MODELS_CONFIG', () => {
    it('has default model', () => {
        expect(DEFAULT_MODELS_CONFIG.default).toContain('anthropic/');
    });

    it('has aliases', () => {
        expect(DEFAULT_MODELS_CONFIG.aliases?.sonnet).toBeDefined();
        expect(DEFAULT_MODELS_CONFIG.aliases?.gpt4).toContain('openai/');
        expect(DEFAULT_MODELS_CONFIG.aliases?.gemini).toContain('google/');
    });
});

describe('createDefaultConfig', () => {
    it('returns valid config object', () => {
        const cfg = createDefaultConfig();
        expect(cfg.version).toBe('1.0');
    });

    it('includes agent defaults', () => {
        const cfg = createDefaultConfig();
        expect(cfg.agents?.defaults?.temperature).toBe(0.7);
        expect(cfg.agents?.defaults?.maxTokens).toBe(8192);
    });

    it('includes gateway defaults', () => {
        const cfg = createDefaultConfig();
        expect(cfg.gateway?.port).toBe(3577);
    });

    it('includes sandbox defaults', () => {
        const cfg = createDefaultConfig();
        expect(cfg.sandbox?.mode).toBe('off');
    });

    it('includes logging defaults', () => {
        const cfg = createDefaultConfig();
        expect(cfg.logging?.level).toBe('info');
    });
});
