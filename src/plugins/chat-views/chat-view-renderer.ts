/**
 * CoreBlow — Interactive Plugin Views in Chat & Multi-Surface Renderer
 *
 * Implements pure Data-Oriented Programming (DOP) contracts, strict XSS sanitization,
 * and multi-surface rendering (Markdown card, Web Cockpit HTML snippet, and structured blocks)
 * for plugin interactive views.
 */

export type ChatViewActionButtonStyle = "primary" | "secondary" | "danger";

export interface ChatViewActionButton {
  readonly id: string;
  readonly label: string;
  readonly actionUrlOrCommand: string;
  readonly style: ChatViewActionButtonStyle;
  readonly requiresConfirmation?: boolean;
}

export type ChatNativeViewType =
  | "kanban_board"
  | "pr_scorecard"
  | "memory_wiki_card"
  | "approval_prompt"
  | "quota_gauge";

export type ChatViewBadge = "ok" | "warn" | "error";

export interface ChatViewField {
  readonly label: string;
  readonly value: string;
  readonly badge?: ChatViewBadge;
}

export interface ChatNativePluginView {
  readonly viewId: string;
  readonly pluginId: string;
  readonly viewType: ChatNativeViewType;
  readonly title: string;
  readonly subtitle?: string;
  readonly fields: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly badge?: ChatViewBadge;
  }>;
  readonly actions: readonly ChatViewActionButton[];
  readonly updatedAtMs: number;
}

export interface RenderedChatNativeView {
  readonly markdownCard: string;
  readonly cockpitHtmlSnippet: string;
  readonly structuredBlocks: Readonly<Record<string, unknown>>;
}

/**
 * Escapes/neutralizes <script>, javascript:, onerror=, onload=, and any inline on\w+= XSS vectors.
 * Converts < and > to &lt; and &gt;, " to &quot;, ' to &#39;.
 * Replaces javascript: pseudo-protocols with blocked-javascript:.
 * Neutralizes event handlers to data-blocked-onerror=, etc.
 * Ensures plugin views are 100% safe to render in Web Cockpit and chat clients.
 */
export function sanitizeChatViewText(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  let sanitized = input;

  // 1. Neutralize javascript: and vbscript: pseudo-protocols (case-insensitive, optional whitespace)
  sanitized = sanitized.replace(/(?<!blocked-)javascript\s*:/gi, "blocked-javascript:");
  sanitized = sanitized.replace(/(?<!blocked-)vbscript\s*:/gi, "blocked-vbscript:");

  // 2. Neutralize inline event handlers on\w+= (e.g. onerror=, onload=, onmouseover=)
  sanitized = sanitized.replace(
    /(?<!data-blocked-)\bon([a-zA-Z]+)\s*=/gi,
    (match) => `data-blocked-${match}`,
  );

  // 3. Neutralize angle brackets and quotes into standard HTML entities
  sanitized = sanitized
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return sanitized;
}

/**
 * Pure DOP multi-surface renderer generating:
 * - markdownCard: Clean Markdown formatting with title, subtitle, badges ([OK], [WARN], [ERROR]),
 *   action buttons, and timestamp.
 * - cockpitHtmlSnippet: Sanitized HTML with container <div class="coreblow-chat-view ...">,
 *   field list, badges, buttons, with all dynamic text passed through sanitizeChatViewText.
 * - structuredBlocks: JSON object with metadata, fields, actions, and timestamp.
 */
export function renderChatNativeView(view: ChatNativePluginView): RenderedChatNativeView {
  // 1. Markdown Card
  const mdLines: string[] = [];
  mdLines.push(`### [${view.title}]`);
  if (view.subtitle) {
    mdLines.push(`_${view.subtitle}_`);
  }
  mdLines.push(`**Type:** \`${view.viewType}\` | **Plugin:** \`${view.pluginId}\``);
  mdLines.push("");

  if (view.fields.length > 0) {
    mdLines.push("**Fields:**");
    for (const f of view.fields) {
      const badgeMarker = f.badge ? ` [${f.badge.toUpperCase()}]` : "";
      mdLines.push(`- **${f.label}:** ${f.value}${badgeMarker}`);
    }
    mdLines.push("");
  }

  if (view.actions.length > 0) {
    mdLines.push("**Actions:**");
    for (const a of view.actions) {
      const confirmNotice = a.requiresConfirmation ? " ⚠️ _(Confirmation Required)_" : "";
      mdLines.push(`- [**${a.label}**] (\`${a.actionUrlOrCommand}\`) [${a.style}]${confirmNotice}`);
    }
    mdLines.push("");
  }

  const dateIso = Number.isFinite(view.updatedAtMs)
    ? new Date(view.updatedAtMs).toISOString()
    : new Date().toISOString();
  mdLines.push(`_Updated: ${dateIso}_`);
  const markdownCard = mdLines.join("\n");

  // 2. Cockpit HTML Snippet
  const safeViewId = sanitizeChatViewText(view.viewId);
  const safePluginId = sanitizeChatViewText(view.pluginId);
  const safeViewType = sanitizeChatViewText(view.viewType);
  const safeTitle = sanitizeChatViewText(view.title);
  const safeSubtitle = view.subtitle
    ? `    <p class="coreblow-chat-view-subtitle">${sanitizeChatViewText(view.subtitle)}</p>`
    : "";

  const fieldsHtml = view.fields
    .map((f) => {
      const safeLabel = sanitizeChatViewText(f.label);
      const safeValue = sanitizeChatViewText(f.value);
      const badgeHtml = f.badge
        ? `<span class="coreblow-badge coreblow-badge-${sanitizeChatViewText(f.badge)}">[${sanitizeChatViewText(f.badge.toUpperCase())}]</span> `
        : "";
      return `<dt class="coreblow-field-label">${safeLabel}</dt><dd class="coreblow-field-value">${badgeHtml}<span>${safeValue}</span></dd>`;
    })
    .join("");

  const actionsHtml = view.actions
    .map((a) => {
      const safeLabel = sanitizeChatViewText(a.label);
      const safeCmd = sanitizeChatViewText(a.actionUrlOrCommand);
      const safeStyle = sanitizeChatViewText(a.style);
      const confirmAttr = a.requiresConfirmation ? ' data-requires-confirmation="true"' : "";
      return `<button type="button" class="coreblow-btn coreblow-btn-${safeStyle}" data-action="${safeCmd}"${confirmAttr}>${safeLabel}</button>`;
    })
    .join("");

  const cockpitLines = [
    `<div class="coreblow-chat-view coreblow-chat-view-${safeViewType}" data-view-id="${safeViewId}" data-plugin-id="${safePluginId}">`,
    `  <div class="coreblow-chat-view-header">`,
    `    <h3 class="coreblow-chat-view-title">${safeTitle}</h3>`,
    safeSubtitle,
    `  </div>`,
    `  <div class="coreblow-chat-view-body">`,
    `    <dl class="coreblow-chat-view-fields">`,
    `      ${fieldsHtml}`,
    `    </dl>`,
    `  </div>`,
    view.actions.length > 0 ? `  <div class="coreblow-chat-view-actions">${actionsHtml}</div>` : "",
    `</div>`,
  ].filter(Boolean);

  const cockpitHtmlSnippet = cockpitLines.join("\n");

  // 3. Structured Blocks
  const structuredBlocks: Readonly<Record<string, unknown>> = Object.freeze({
    type: "native_plugin_view",
    version: "1.0.0",
    viewId: view.viewId,
    pluginId: view.pluginId,
    viewType: view.viewType,
    title: view.title,
    subtitle: view.subtitle,
    fields: Object.freeze(view.fields.map((f) => Object.freeze({ ...f }))),
    actions: Object.freeze(view.actions.map((a) => Object.freeze({ ...a }))),
    updatedAtMs: view.updatedAtMs,
  });

  return Object.freeze({
    markdownCard,
    cockpitHtmlSnippet,
    structuredBlocks,
  });
}
