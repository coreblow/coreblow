/**
 * CoreBlow — Conversation Exporter
 *
 * Exports conversation history in multiple formats:
 * JSON, Markdown, HTML, and plain text. Supports
 * metadata inclusion, timestamp formatting, and filtering.
 */

/** Export message */
export interface ExportMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** Export options */
export interface ExportOptions {
    format: 'json' | 'markdown' | 'html' | 'text';
    includeSystem?: boolean;
    includeTimestamps?: boolean;
    includeMetadata?: boolean;
    title?: string;
}

/** Export result */
export interface ExportResult {
    content: string;
    format: string;
    messageCount: number;
    exportedAt: number;
}

/**
 * CoreBlow Conversation Exporter
 */
export class ConversationExporter {
    /**
     * Export messages to specified format.
     */
    export(messages: ExportMessage[], opts: ExportOptions): ExportResult {
        const filtered = opts.includeSystem !== false
            ? messages
            : messages.filter((m) => m.role !== 'system');

        let content: string;
        switch (opts.format) {
            case 'json': content = this.toJSON(filtered, opts); break;
            case 'markdown': content = this.toMarkdown(filtered, opts); break;
            case 'html': content = this.toHTML(filtered, opts); break;
            case 'text': content = this.toText(filtered, opts); break;
            default: content = this.toJSON(filtered, opts);
        }

        return {
            content,
            format: opts.format,
            messageCount: filtered.length,
            exportedAt: Date.now(),
        };
    }

    /**
     * Export to JSON.
     */
    private toJSON(messages: ExportMessage[], opts: ExportOptions): string {
        const data = {
            title: opts.title ?? 'CoreBlow Conversation',
            exportedAt: new Date().toISOString(),
            messageCount: messages.length,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(opts.includeTimestamps ? { timestamp: new Date(m.timestamp).toISOString() } : {}),
                ...(opts.includeMetadata && m.metadata ? { metadata: m.metadata } : {}),
            })),
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Export to Markdown.
     */
    private toMarkdown(messages: ExportMessage[], opts: ExportOptions): string {
        const lines: string[] = [];
        lines.push(`# ${opts.title ?? 'CoreBlow Conversation'}`);
        lines.push('');
        lines.push(`*Exported: ${new Date().toISOString()}*`);
        lines.push('');
        lines.push('---');
        lines.push('');

        for (const msg of messages) {
            const roleLabel = this.roleLabel(msg.role);
            if (opts.includeTimestamps) {
                lines.push(`### ${roleLabel} — ${new Date(msg.timestamp).toLocaleString()}`);
            } else {
                lines.push(`### ${roleLabel}`);
            }
            lines.push('');
            lines.push(msg.content);
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Export to HTML.
     */
    private toHTML(messages: ExportMessage[], opts: ExportOptions): string {
        const msgHTML = messages.map((m) => {
            const time = opts.includeTimestamps ? `<time>${new Date(m.timestamp).toLocaleString()}</time>` : '';
            return `<div class="message ${m.role}"><strong>${this.roleLabel(m.role)}</strong>${time}<p>${this.escapeHTML(m.content)}</p></div>`;
        }).join('\n');

        return `<!DOCTYPE html>
<html><head><title>${opts.title ?? 'CoreBlow Conversation'}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}.message{margin:16px 0;padding:12px;border-radius:8px}.user{background:#e3f2fd}.assistant{background:#f3e5f5}.system{background:#fff3e0}time{margin-left:8px;font-size:0.8em;color:#666}</style>
</head><body>
<h1>${opts.title ?? 'CoreBlow Conversation'}</h1>
${msgHTML}
</body></html>`;
    }

    /**
     * Export to plain text.
     */
    private toText(messages: ExportMessage[], opts: ExportOptions): string {
        return messages.map((m) => {
            const time = opts.includeTimestamps ? ` [${new Date(m.timestamp).toLocaleString()}]` : '';
            return `[${m.role.toUpperCase()}]${time}\n${m.content}\n`;
        }).join('\n');
    }

    // === Helpers ===

    private roleLabel(role: string): string {
        switch (role) {
            case 'user': return '👤 User';
            case 'assistant': return '🤖 Assistant';
            case 'system': return '⚙️ System';
            case 'tool': return '🔧 Tool';
            default: return role;
        }
    }

    private escapeHTML(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }
}
