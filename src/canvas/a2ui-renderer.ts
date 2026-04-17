/**
 * CoreBlow — A2UI v0.9 Renderer
 *
 * Agent-to-UI protocol version 0.9 using FLAT ADJACENCY LIST.
 * Skips v0.8 nested JSON entirely — competitive advantage.
 *
 * v0.9 "Prompt-First" approach:
 *  - Flat component list (no nesting = fewer tokens)
 *  - Parent-child references via IDs
 *  - Drastically reduces LLM hallucination risk
 *  - Components are simple key-value objects
 *
 * Format:
 *   { id: "root", type: "column", children: ["header", "content"] }
 *   { id: "header", type: "text", value: "Hello World" }
 *   { id: "content", type: "button", label: "Click me", action: "greet" }
 */

// ─── Types ──────────────────────────────────────────────────────

export type A2UIComponentType =
    | 'column' | 'row' | 'stack'  // Layout
    | 'text' | 'heading'          // Text
    | 'button' | 'input' | 'select' | 'checkbox' | 'slider' // Interactive
    | 'image' | 'code' | 'markdown'  // Content
    | 'table' | 'chart'             // Data
    | 'divider' | 'spacer'          // Utility
    | 'card' | 'badge' | 'progress'; // Display

export interface A2UIComponent {
    /** Unique component ID */
    id: string;
    /** Component type */
    type: A2UIComponentType;
    /** Child component IDs (for layout components) */
    children?: string[];
    /** Text value */
    value?: string;
    /** Label (buttons, inputs) */
    label?: string;
    /** Placeholder (inputs) */
    placeholder?: string;
    /** Action ID (buttons — dispatched to agent) */
    action?: string;
    /** Options (select, chart) */
    options?: Array<{ label: string; value: string }>;
    /** Image source (URL or base64) */
    src?: string;
    /** Code language */
    language?: string;
    /** Style overrides */
    style?: Record<string, string>;
    /** Level (headings: 1-6) */
    level?: number;
    /** Min/Max/Step (slider) */
    min?: number;
    max?: number;
    step?: number;
    /** Checked state (checkbox) */
    checked?: boolean;
    /** Progress value (0-100) */
    progress?: number;
    /** Chart type */
    chartType?: 'bar' | 'line' | 'pie' | 'donut';
    /** Chart data */
    data?: Array<{ label: string; value: number }>;
    /** Table headers */
    headers?: string[];
    /** Table rows */
    rows?: string[][];
    /** Disabled state */
    disabled?: boolean;
    /** Variant */
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
}

export interface A2UITree {
    /** Protocol version */
    version: '0.9';
    /** Root component ID */
    root: string;
    /** Flat list of all components */
    components: A2UIComponent[];
    /** Title for the UI */
    title?: string;
    /** Theme */
    theme?: 'light' | 'dark' | 'auto';
}

// ─── Renderer ───────────────────────────────────────────────────

/**
 * Render an A2UI v0.9 tree to HTML.
 */
export function renderA2UIToHTML(tree: A2UITree): string {
    const componentMap = new Map(tree.components.map(c => [c.id, c]));
    const rootComponent = componentMap.get(tree.root);
    if (!rootComponent) return '<div>Error: Root component not found</div>';

    const isDark = tree.theme === 'dark' || tree.theme === 'auto';
    const bodyHtml = renderComponent(rootComponent, componentMap);

    return `<!DOCTYPE html>
<html lang="en" data-theme="${tree.theme ?? 'auto'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(tree.title ?? 'CoreBlow Canvas')}</title>
<style>
${getBaseCSS(isDark)}
</style>
</head>
<body>
<div id="a2ui-root">${bodyHtml}</div>
<script>
${getInteractionScript()}
</script>
</body>
</html>`;
}

/**
 * Validate an A2UI tree structure.
 */
export function validateA2UITree(tree: A2UITree): string[] {
    const errors: string[] = [];

    if (tree.version !== '0.9') errors.push(`Unsupported version: ${tree.version}`);
    if (!tree.root) errors.push('Missing root component ID');
    if (!tree.components || tree.components.length === 0) errors.push('No components defined');

    const ids = new Set<string>();
    for (const comp of tree.components) {
        if (!comp.id) errors.push('Component missing id');
        if (!comp.type) errors.push(`Component ${comp.id} missing type`);
        if (ids.has(comp.id)) errors.push(`Duplicate component id: ${comp.id}`);
        ids.add(comp.id);

        // Validate children references
        if (comp.children) {
            for (const childId of comp.children) {
                if (!tree.components.some(c => c.id === childId)) {
                    errors.push(`Component ${comp.id} references non-existent child: ${childId}`);
                }
            }
        }
    }

    if (!ids.has(tree.root)) errors.push(`Root component "${tree.root}" not found`);

    return errors;
}

/**
 * Convert flat component list from LLM output to A2UITree.
 */
export function parseA2UIFromComponents(
    components: A2UIComponent[],
    opts?: { root?: string; title?: string; theme?: 'light' | 'dark' | 'auto' },
): A2UITree {
    const root = opts?.root ?? components[0]?.id ?? 'root';
    return {
        version: '0.9',
        root,
        components,
        title: opts?.title,
        theme: opts?.theme ?? 'auto',
    };
}

// ─── Component Renderer ─────────────────────────────────────────

function renderComponent(comp: A2UIComponent, map: Map<string, A2UIComponent>): string {
    const style = comp.style ? styleToString(comp.style) : '';
    const styleAttr = style ? ` style="${style}"` : '';
    const cls = `a2ui-${comp.type}${comp.variant ? ` a2ui-${comp.variant}` : ''}`;

    switch (comp.type) {
        case 'column':
        case 'row':
        case 'stack':
            return `<div class="${cls}" id="${comp.id}"${styleAttr}>${renderChildren(comp.children, map)}</div>`;

        case 'text':
            return `<p class="${cls}" id="${comp.id}"${styleAttr}>${escapeHtml(comp.value ?? '')}</p>`;

        case 'heading':
            const level = Math.min(Math.max(comp.level ?? 1, 1), 6);
            return `<h${level} class="${cls}" id="${comp.id}"${styleAttr}>${escapeHtml(comp.value ?? '')}</h${level}>`;

        case 'button':
            return `<button class="${cls}" id="${comp.id}"${styleAttr} data-action="${comp.action ?? ''}"${comp.disabled ? ' disabled' : ''}>${escapeHtml(comp.label ?? comp.value ?? 'Button')}</button>`;

        case 'input':
            return `<input class="${cls}" id="${comp.id}"${styleAttr} placeholder="${escapeHtml(comp.placeholder ?? '')}" value="${escapeHtml(comp.value ?? '')}"${comp.disabled ? ' disabled' : ''}>`;

        case 'select':
            const opts = (comp.options ?? []).map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
            return `<select class="${cls}" id="${comp.id}"${styleAttr}${comp.disabled ? ' disabled' : ''}>${opts}</select>`;

        case 'checkbox':
            return `<label class="${cls}" id="${comp.id}"${styleAttr}><input type="checkbox"${comp.checked ? ' checked' : ''}${comp.disabled ? ' disabled' : ''}> ${escapeHtml(comp.label ?? '')}</label>`;

        case 'slider':
            return `<input type="range" class="${cls}" id="${comp.id}"${styleAttr} min="${comp.min ?? 0}" max="${comp.max ?? 100}" step="${comp.step ?? 1}" value="${comp.value ?? 50}">`;

        case 'image':
            return `<img class="${cls}" id="${comp.id}"${styleAttr} src="${escapeHtml(comp.src ?? '')}" alt="${escapeHtml(comp.label ?? '')}" loading="lazy">`;

        case 'code':
            return `<pre class="${cls}" id="${comp.id}"${styleAttr}><code class="language-${comp.language ?? 'text'}">${escapeHtml(comp.value ?? '')}</code></pre>`;

        case 'markdown':
            // Basic markdown rendering (heading, bold, italic, code)
            return `<div class="${cls}" id="${comp.id}"${styleAttr}>${basicMarkdown(comp.value ?? '')}</div>`;

        case 'table':
            return renderTable(comp, cls, styleAttr);

        case 'chart':
            return `<div class="${cls}" id="${comp.id}"${styleAttr} data-chart-type="${comp.chartType ?? 'bar'}" data-chart='${JSON.stringify(comp.data ?? [])}'><canvas></canvas></div>`;

        case 'divider':
            return `<hr class="${cls}" id="${comp.id}"${styleAttr}>`;

        case 'spacer':
            return `<div class="${cls}" id="${comp.id}" style="height:${comp.style?.height ?? '16px'}"></div>`;

        case 'card':
            return `<div class="${cls}" id="${comp.id}"${styleAttr}>${comp.value ? `<p>${escapeHtml(comp.value)}</p>` : ''}${renderChildren(comp.children, map)}</div>`;

        case 'badge':
            return `<span class="${cls}" id="${comp.id}"${styleAttr}>${escapeHtml(comp.value ?? '')}</span>`;

        case 'progress':
            return `<div class="${cls}" id="${comp.id}"${styleAttr}><div class="a2ui-progress-bar" style="width:${comp.progress ?? 0}%"></div></div>`;

        default:
            return `<div class="${cls}" id="${comp.id}"${styleAttr}>${escapeHtml(comp.value ?? '')}</div>`;
    }
}

function renderChildren(childIds: string[] | undefined, map: Map<string, A2UIComponent>): string {
    if (!childIds) return '';
    return childIds.map(id => {
        const child = map.get(id);
        return child ? renderComponent(child, map) : `<!-- missing: ${id} -->`;
    }).join('\n');
}

function renderTable(comp: A2UIComponent, cls: string, styleAttr: string): string {
    const headers = comp.headers ?? [];
    const rows = comp.rows ?? [];
    const thead = headers.length > 0
        ? `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
        : '';
    const tbody = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table class="${cls}" id="${comp.id}"${styleAttr}>${thead}${tbody}</table>`;
}

// ─── Helpers ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function styleToString(style: Record<string, string>): string {
    return Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
}

function basicMarkdown(md: string): string {
    return md
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// ─── CSS & JS ───────────────────────────────────────────────────

function getBaseCSS(isDark: boolean): string {
    const bg = isDark ? '#0a0a0a' : '#ffffff';
    const fg = isDark ? '#e0e0e0' : '#1a1a1a';
    const accent = '#6366f1';
    const surface = isDark ? '#1a1a2e' : '#f5f5f5';
    const border = isDark ? '#2a2a3e' : '#e0e0e0';

    return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:${bg};color:${fg};padding:24px;line-height:1.6}
.a2ui-column{display:flex;flex-direction:column;gap:12px}
.a2ui-row{display:flex;flex-direction:row;gap:12px;align-items:center;flex-wrap:wrap}
.a2ui-stack{position:relative}
.a2ui-text{font-size:16px}
.a2ui-heading{margin:8px 0}
.a2ui-button{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;background:${accent};color:white;transition:all 0.2s}
.a2ui-button:hover{opacity:0.9;transform:translateY(-1px)}
.a2ui-button:disabled{opacity:0.5;cursor:not-allowed}
.a2ui-button.a2ui-danger{background:#ef4444}
.a2ui-button.a2ui-success{background:#22c55e}
.a2ui-button.a2ui-warning{background:#f59e0b;color:#000}
.a2ui-button.a2ui-secondary{background:${surface};color:${fg};border:1px solid ${border}}
.a2ui-input,.a2ui-select{padding:10px 14px;border:1px solid ${border};border-radius:8px;background:${surface};color:${fg};font-size:14px;width:100%}
.a2ui-input:focus,.a2ui-select:focus{outline:none;border-color:${accent};box-shadow:0 0 0 3px ${accent}33}
.a2ui-checkbox{display:flex;align-items:center;gap:8px;cursor:pointer}
.a2ui-slider{width:100%;accent-color:${accent}}
.a2ui-image{max-width:100%;border-radius:8px}
.a2ui-code{background:${isDark ? '#111' : '#f0f0f0'};padding:16px;border-radius:8px;overflow-x:auto;font-family:monospace;font-size:13px}
.a2ui-markdown{line-height:1.8}
.a2ui-table{width:100%;border-collapse:collapse}
.a2ui-table th,.a2ui-table td{padding:10px 14px;text-align:left;border-bottom:1px solid ${border}}
.a2ui-table th{font-weight:600;background:${surface}}
.a2ui-divider{border:none;border-top:1px solid ${border};margin:16px 0}
.a2ui-card{background:${surface};border:1px solid ${border};border-radius:12px;padding:20px}
.a2ui-badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${accent};color:white}
.a2ui-badge.a2ui-danger{background:#ef4444}
.a2ui-badge.a2ui-success{background:#22c55e}
.a2ui-progress{width:100%;height:8px;background:${surface};border-radius:4px;overflow:hidden}
.a2ui-progress-bar{height:100%;background:${accent};border-radius:4px;transition:width 0.3s}
`;
}

function getInteractionScript(): string {
    return `
document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        if (action) {
            console.log('[A2UI] Action:', action);
            window.dispatchEvent(new CustomEvent('a2ui-action', { detail: { action, componentId: this.id } }));
        }
    });
});
`;
}
