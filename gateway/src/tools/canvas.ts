/**
 * src/tools/canvas.ts
 * Canvas tool — AI-generated interactive HTML workspace
 * The agent can create, update, and serve HTML/CSS/JS content
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ToolHandler } from './types.js';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:canvas');

function getCanvasDir(): string {
    const dir = path.join(getHomeDir(), 'canvas');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

export const canvasTool: ToolHandler = {
    name: 'canvas',
    description: 'Create, update, or read AI-generated HTML/CSS/JS workspaces. Use this to build interactive UIs, dashboards, visualizations, or any web content for the user.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'update', 'read', 'list', 'delete'],
                description: 'Action to perform',
            },
            name: {
                type: 'string',
                description: 'Canvas name (used as filename, e.g. "dashboard", "chart")',
            },
            html: {
                type: 'string',
                description: 'Full HTML content (for create/update). Include <!DOCTYPE html> and inline CSS/JS.',
            },
            section: {
                type: 'string',
                enum: ['html', 'css', 'js'],
                description: 'Optional: update only a specific section (body content, style, or script)',
            },
            content: {
                type: 'string',
                description: 'Content for the specific section (used with section parameter)',
            },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, name, html, section, content } = args;
        const canvasDir = getCanvasDir();

        switch (action) {
            case 'create':
            case 'update': {
                if (!name) return 'Error: name is required';
                const filePath = path.join(canvasDir, `${name}.html`);

                if (section && content) {
                    // Partial update: only CSS, JS, or body
                    let existing = '';
                    if (fs.existsSync(filePath)) {
                        existing = fs.readFileSync(filePath, 'utf-8');
                    } else {
                        existing = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
<style>/* styles */</style>
</head>
<body><!-- content --></body>
<script>/* script */</script>
</html>`;
                    }

                    if (section === 'css') {
                        existing = existing.replace(/<style>[\s\S]*?<\/style>/, `<style>${content}</style>`);
                    } else if (section === 'js') {
                        existing = existing.replace(/<script>[\s\S]*?<\/script>/, `<script>${content}</script>`);
                    } else if (section === 'html') {
                        existing = existing.replace(/<body>[\s\S]*?<\/body>/, `<body>${content}</body>`);
                    }

                    fs.writeFileSync(filePath, existing);
                    log.info({ name, section }, 'Canvas section updated');
                    return `Canvas "${name}" section "${section}" updated. View at /canvas/${name}.html`;
                }

                if (!html) return 'Error: html content is required for create/update';
                fs.writeFileSync(filePath, html);
                log.info({ name, size: html.length }, `Canvas ${action}d`);
                return `Canvas "${name}" ${action}d (${html.length} bytes). View at /canvas/${name}.html`;
            }

            case 'read': {
                if (!name) return 'Error: name is required';
                const filePath = path.join(canvasDir, `${name}.html`);
                if (!fs.existsSync(filePath)) return `Canvas "${name}" not found`;
                const content = fs.readFileSync(filePath, 'utf-8');
                return content.length > 4000
                    ? content.substring(0, 4000) + '\n... (truncated)'
                    : content;
            }

            case 'list': {
                const files = fs.readdirSync(canvasDir)
                    .filter(f => f.endsWith('.html'))
                    .map(f => {
                        const stat = fs.statSync(path.join(canvasDir, f));
                        return `${f} (${stat.size} bytes, ${new Date(stat.mtime).toLocaleString()})`;
                    });
                return files.length > 0
                    ? `Canvases:\n${files.join('\n')}`
                    : 'No canvases found. Use canvas create to make one.';
            }

            case 'delete': {
                if (!name) return 'Error: name is required';
                const filePath = path.join(canvasDir, `${name}.html`);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    return `Canvas "${name}" deleted.`;
                }
                return `Canvas "${name}" not found.`;
            }

            default:
                return 'Unknown action. Use: create, update, read, list, delete';
        }
    },
};
