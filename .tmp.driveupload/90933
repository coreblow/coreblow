/**
 * agents/tool-definitions.ts
 * Concrete tool handler registration for the AgentEngine.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AgentEngine } from './agent-engine.js';
import { execCommand } from './bash-tools.js';
import { isUnsafeCommand } from './shell-utils.js';
import { globMatch, globMatchAny } from './glob-pattern.js';

/**
 * Register all built-in tools on the engine.
 */
export function registerBuiltinTools(engine: AgentEngine): void {
    // ─── Bash ────────────────────────────────────────────────
    engine.registerTool({
        name: 'bash',
        description: 'Execute a shell command. Use for running scripts, installing packages, compiling, or any CLI operation.',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The shell command to execute' },
                timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
            },
            required: ['command'],
        },
        handler: async (args) => {
            const command = args.command as string;
            const timeout = (args.timeout as number) ?? 30_000;
            const result = await execCommand({ command, timeout, cwd: engine.config.sandboxBaseDir });
            const parts: string[] = [];
            if (result.stdout) parts.push(result.stdout);
            if (result.stderr) parts.push(`stderr: ${result.stderr}`);
            parts.push(`exit code: ${result.exitCode}`);
            if (result.truncated) parts.push('(output truncated)');
            return parts.join('\n');
        },
    });

    // ─── Read File ───────────────────────────────────────────
    engine.registerTool({
        name: 'read_file',
        description: 'Read the contents of a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path to the file' },
                start_line: { type: 'number', description: 'Start line (1-indexed)' },
                end_line: { type: 'number', description: 'End line (1-indexed, inclusive)' },
            },
            required: ['path'],
        },
        handler: async (args) => {
            const filePath = path.resolve(args.path as string);
            const sandbox = engine.getSandbox();
            const check = sandbox.isPathAllowed(filePath);
            if (!check.allowed) return `Error: ${check.reason}`;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const startLine = args.start_line as number | undefined;
                const endLine = args.end_line as number | undefined;
                if (startLine !== undefined) {
                    const lines = content.split('\n');
                    return lines.slice((startLine ?? 1) - 1, endLine ?? lines.length).join('\n');
                }
                return content;
            } catch (err) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
        },
    });

    // ─── Write File ──────────────────────────────────────────
    engine.registerTool({
        name: 'write_file',
        description: 'Create or overwrite a file with the given content.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path to the file' },
                content: { type: 'string', description: 'Content to write' },
            },
            required: ['path', 'content'],
        },
        handler: async (args) => {
            const filePath = path.resolve(args.path as string);
            const sandbox = engine.getSandbox();
            const check = sandbox.isPathAllowed(filePath);
            if (!check.allowed) return `Error: ${check.reason}`;
            try {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, args.content as string, 'utf-8');
                return `File written: ${filePath}`;
            } catch (err) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
        },
    });

    // ─── Edit File ───────────────────────────────────────────
    engine.registerTool({
        name: 'edit_file',
        description: 'Replace a specific string in a file.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Absolute path to the file' },
                old_string: { type: 'string', description: 'Exact string to find and replace' },
                new_string: { type: 'string', description: 'Replacement string' },
            },
            required: ['path', 'old_string', 'new_string'],
        },
        handler: async (args) => {
            const filePath = path.resolve(args.path as string);
            const sandbox = engine.getSandbox();
            const check = sandbox.isPathAllowed(filePath);
            if (!check.allowed) return `Error: ${check.reason}`;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const oldStr = args.old_string as string;
                if (!content.includes(oldStr)) return `Error: old_string not found in file`;
                const newContent = content.replace(oldStr, args.new_string as string);
                fs.writeFileSync(filePath, newContent, 'utf-8');
                return `File edited: ${filePath}`;
            } catch (err) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
        },
    });

    // ─── Search (Grep) ───────────────────────────────────────
    engine.registerTool({
        name: 'search',
        description: 'Search for a pattern in files using ripgrep-style matching.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Search pattern (regex)' },
                path: { type: 'string', description: 'Directory to search in' },
                include: { type: 'string', description: 'Glob pattern for file filtering' },
            },
            required: ['pattern', 'path'],
        },
        handler: async (args) => {
            const searchPath = path.resolve(args.path as string);
            const pattern = args.pattern as string;
            const result = await execCommand({
                command: `grep -rnI "${pattern.replace(/"/g, '\\"')}" "${searchPath}" ${args.include ? `--include="${args.include}"` : ''} | head -50`,
                timeout: 10_000, cwd: engine.config.sandboxBaseDir,
            });
            return result.stdout || '(no matches)';
        },
    });

    // ─── List Directory ──────────────────────────────────────
    engine.registerTool({
        name: 'list_dir',
        description: 'List contents of a directory.',
        parameters: {
            type: 'object',
            properties: { path: { type: 'string', description: 'Directory path' } },
            required: ['path'],
        },
        handler: async (args) => {
            const dirPath = path.resolve(args.path as string);
            try {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                return entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
            } catch (err) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
        },
    });

    // ─── Glob ────────────────────────────────────────────────
    engine.registerTool({
        name: 'glob',
        description: 'Find files matching a glob pattern.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts)' },
                path: { type: 'string', description: 'Base directory' },
            },
            required: ['pattern', 'path'],
        },
        handler: async (args) => {
            const basePath = path.resolve(args.path as string);
            const pattern = args.pattern as string;
            const result = await execCommand({
                command: `find "${basePath}" -type f | head -500`,
                timeout: 10_000, cwd: engine.config.sandboxBaseDir,
            });
            const files = (result.stdout || '').split('\n').filter(f => f && globMatch(pattern, path.basename(f)));
            return files.length > 0 ? files.join('\n') : '(no matches)';
        },
    });
}
