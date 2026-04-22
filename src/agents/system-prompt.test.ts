import { describe, it, expect } from 'vitest';
import {
    buildAgentSystemPrompt,
    buildRuntimeLine,
    type SystemPromptParams,
} from './system-prompt.js';

describe('buildAgentSystemPrompt', () => {
    const baseParams: SystemPromptParams = {
        workspaceDir: '/home/user/project',
    };

    it('should return minimal identity for "none" mode', () => {
        const result = buildAgentSystemPrompt({ ...baseParams, promptMode: 'none' });
        expect(result).toBe('You are a personal assistant running inside CoreBlow.');
    });

    it('should include all major sections for "full" mode', () => {
        const result = buildAgentSystemPrompt({ ...baseParams, promptMode: 'full' });
        expect(result).toContain('## Tooling');
        expect(result).toContain('## Tool Call Style');
        expect(result).toContain('## Safety');
        expect(result).toContain('## CoreBlow CLI Quick Reference');
        expect(result).toContain('## Workspace');
        expect(result).toContain('## Workspace Files (injected)');
    });

    it('should include tool lines when tools are provided', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            toolNames: ['read', 'write', 'exec', 'grep'],
        });
        expect(result).toContain('- read: Read file contents');
        expect(result).toContain('- write: Create or overwrite files');
        expect(result).toContain('- exec: Run shell commands');
        expect(result).toContain('- grep: Search file contents');
    });

    it('should include extra tool summaries', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            toolNames: ['custom_tool'],
            toolSummaries: { custom_tool: 'My custom tool description' },
        });
        expect(result).toContain('- custom_tool: My custom tool description');
    });

    it('should include workspace directory', () => {
        const result = buildAgentSystemPrompt(baseParams);
        expect(result).toContain('Your working directory is: /home/user/project');
    });

    it('should include skills section when skills prompt is provided', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            skillsPrompt: '<available_skills>my-skill: Does something</available_skills>',
        });
        expect(result).toContain('## Skills (mandatory)');
        expect(result).toContain('my-skill: Does something');
    });

    it('should include owner identity when configured', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            ownerNumbers: ['user123', 'admin456'],
        });
        expect(result).toContain('## Authorized Senders');
        expect(result).toContain('user123');
    });

    it('should hash owner IDs when ownerDisplay is "hash"', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            ownerNumbers: ['user123'],
            ownerDisplay: 'hash',
        });
        expect(result).toContain('## Authorized Senders');
        // Should contain a hex hash, not the raw ID
        expect(result).not.toContain('user123');
    });

    it('should include context files', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            contextFiles: [
                { path: 'README.md', content: '# My Project' },
                { path: 'SOUL.md', content: 'Be helpful and friendly' },
            ],
        });
        expect(result).toContain('# Project Context');
        expect(result).toContain('## README.md');
        expect(result).toContain('# My Project');
        expect(result).toContain('SOUL.md');
        expect(result).toContain('embody its persona');
    });

    it('should skip user-facing sections in "minimal" mode', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            promptMode: 'minimal',
            ownerNumbers: ['user123'],
        });
        // These sections should be skipped in minimal mode
        expect(result).not.toContain('## Authorized Senders');
        expect(result).not.toContain('## Reply Tags');
        expect(result).not.toContain('## Silent Replies');
    });

    it('should include sandbox section when sandbox is enabled', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            sandboxInfo: {
                enabled: true,
                containerWorkspaceDir: '/workspace',
                workspaceDir: '/host/project',
            },
        });
        expect(result).toContain('## Sandbox');
        expect(result).toContain('sandboxed runtime');
        expect(result).toContain('/workspace');
    });

    it('should include silent reply section for full mode', () => {
        const result = buildAgentSystemPrompt(baseParams);
        expect(result).toContain('## Silent Replies');
        expect(result).toContain('%%SILENT%%');
    });

    it('should include heartbeat section when configured', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            heartbeatPrompt: 'HEARTBEAT_PING',
        });
        expect(result).toContain('## Heartbeats');
        expect(result).toContain('HEARTBEAT_PING');
        expect(result).toContain('HEARTBEAT_OK');
    });

    it('should include extra system prompt', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            extraSystemPrompt: 'You are helping in a group chat.',
        });
        expect(result).toContain('## Group Chat Context');
        expect(result).toContain('helping in a group chat');
    });

    it('should use "Subagent Context" header in minimal mode', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            promptMode: 'minimal',
            extraSystemPrompt: 'Subagent task context.',
        });
        expect(result).toContain('## Subagent Context');
    });

    it('should include self-update section when gateway tool is available', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            toolNames: ['gateway'],
        });
        expect(result).toContain('## CoreBlow Self-Update');
    });

    it('should include model alias lines', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            modelAliasLines: [
                'fast → openai/gpt-4o-mini',
                'smart → anthropic/claude-opus-4-6',
            ],
        });
        expect(result).toContain('## Model Aliases');
        expect(result).toContain('fast → openai/gpt-4o-mini');
    });

    it('should include timezone section', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            userTimezone: 'Asia/Jakarta',
        });
        expect(result).toContain('## Current Date & Time');
        expect(result).toContain('Asia/Jakarta');
    });

    it('should include reaction guidance', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            reactionGuidance: { level: 'minimal', channel: 'telegram' },
        });
        expect(result).toContain('## Reactions');
        expect(result).toContain('MINIMAL mode');
        expect(result).toContain('telegram');
    });

    it('should include reasoning hint when enabled', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            reasoningTagHint: true,
        });
        expect(result).toContain('## Reasoning Format');
        expect(result).toContain('<think>');
        expect(result).toContain('<final>');
    });

    it('should include voice section when tts hint is provided', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            ttsHint: 'Speak in a warm, friendly tone.',
        });
        expect(result).toContain('## Voice (TTS)');
        expect(result).toContain('warm, friendly tone');
    });

    it('should include workspace notes', () => {
        const result = buildAgentSystemPrompt({
            ...baseParams,
            workspaceNotes: ['This is a TypeScript project using Vitest.'],
        });
        expect(result).toContain('TypeScript project using Vitest');
    });
});

describe('buildRuntimeLine', () => {
    it('should build a complete runtime line', () => {
        const result = buildRuntimeLine(
            {
                agentId: 'default',
                host: 'localhost',
                os: 'darwin',
                arch: 'arm64',
                node: 'v22.0.0',
                model: 'claude-sonnet-4-5',
                shell: '/bin/zsh',
            },
            'discord',
            ['inlineButtons', 'threads'],
            'medium',
        );
        expect(result).toContain('agent=default');
        expect(result).toContain('host=localhost');
        expect(result).toContain('os=darwin (arm64)');
        expect(result).toContain('node=v22.0.0');
        expect(result).toContain('model=claude-sonnet-4-5');
        expect(result).toContain('channel=discord');
        expect(result).toContain('capabilities=inlineButtons,threads');
        expect(result).toContain('thinking=medium');
    });

    it('should omit empty fields', () => {
        const result = buildRuntimeLine({}, undefined, [], 'off');
        expect(result).toBe('Runtime: thinking=off');
    });

    it('should default thinking to off', () => {
        const result = buildRuntimeLine();
        expect(result).toContain('thinking=off');
    });
});
