import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
const LEVEL_COLORS: Record<LogLevel, string> = {
   trace: "var(--muted, #666)",
   debug: "var(--muted, #888)",
   info: "var(--accent, #6366f1)",
   warn: "var(--warning, #f59e0b)",
   error: "var(--destructive, #ef4444)",
   fatal: "#dc2626",
};

@customElement("coreblow-logs-view")
export class LogsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() filterText = "";
  @state() levelFilters: Record<LogLevel, boolean> = {
     trace: true, debug: true, info: true, warn: true, error: true, fatal: true,
  };
  @state() autoFollow = true;
  @state() maxLines = 200;

  createRenderRoot() { return this; }

  private get filteredEntries() {
     const needle = this.filterText.trim().toLowerCase();
     return this.app.eventLog.filter(e => {
        const level = (e.level || "info") as LogLevel;
        if (!this.levelFilters[level]) return false;
        if (needle && !e.raw.toLowerCase().includes(needle)) return false;
        return true;
     }).slice(0, this.maxLines);
  }

  private toggleLevel(level: LogLevel) {
     this.levelFilters = { ...this.levelFilters, [level]: !this.levelFilters[level] };
  }

  private clearLogs() {
     this.app.eventLog = [];
     this.requestUpdate();
  }

  private exportLogs() {
     const text = this.filteredEntries.map(e =>
        `[${new Date(e.ts).toISOString()}] [${e.level || "info"}] ${e.raw}`
     ).join("\n");
     const blob = new Blob([text], { type: "text/plain" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `coreblow-logs-${Date.now()}.txt`;
     a.click();
     URL.revokeObjectURL(url);
  }

  render() {
    const entries = this.filteredEntries;
    const totalCount = this.app.eventLog.length;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

        <!-- Header -->
        <div class="card">
           <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1;">
                 <div class="card-title">📜 Logs</div>
                 <div class="card-sub">${entries.length} of ${totalCount} entries</div>
              </div>
              <button style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
               @click=${this.exportLogs}>⬇ Export</button>
              <button style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--destructive, #ef4444); font-size: 12px;"
               @click=${this.clearLogs}>🗑 Clear</button>
           </div>

           <!-- Filters -->
           <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <input style="flex: 1; min-width: 200px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px;"
                     placeholder="Filter logs..."
                     .value=${this.filterText}
                     @input=${(e: Event) => this.filterText = (e.target as HTMLInputElement).value} />
              ${LEVELS.map(level => html`
                 <button style="font-size: 10px; padding: 3px 8px; border-radius: 10px; border: 1px solid ${this.levelFilters[level] ? LEVEL_COLORS[level] : 'var(--border)'}; background: ${this.levelFilters[level] ? LEVEL_COLORS[level] + '20' : 'transparent'}; color: ${this.levelFilters[level] ? LEVEL_COLORS[level] : 'var(--muted)'}; cursor: pointer; font-weight: 600; text-transform: uppercase;"
                  @click=${() => this.toggleLevel(level)}>${level}</button>
              `)}
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); cursor: pointer; margin-left: 8px;">
                 <input type="checkbox" .checked=${this.autoFollow} @change=${(e: Event) => this.autoFollow = (e.target as HTMLInputElement).checked} />
                 Auto-follow
              </label>
           </div>
        </div>

        <!-- Log Stream -->
        <div class="card" style="padding: 0; overflow: hidden;">
           <div style="max-height: 600px; overflow-y: auto; font-family: var(--mono); font-size: 11px;" id="log-stream">
              ${entries.length === 0 ? html`
                 <div style="padding: 40px; text-align: center; color: var(--muted);">No log entries${this.filterText ? " matching filter" : ""}</div>
              ` : ""}
              ${entries.map(e => {
                 const level = (e.level || "info") as LogLevel;
                 const color = LEVEL_COLORS[level] || "var(--foreground)";
                 return html`
                    <div style="padding: 3px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); display: flex; gap: 8px; line-height: 1.6;">
                       <span style="color: var(--muted); min-width: 72px; flex-shrink: 0;">${new Date(e.ts).toLocaleTimeString()}</span>
                       <span style="color: ${color}; min-width: 40px; font-weight: 700; text-transform: uppercase; font-size: 10px; flex-shrink: 0;">${level}</span>
                       <span style="color: var(--foreground); word-break: break-all;">${e.raw}</span>
                    </div>
                 `;
              })}
           </div>
        </div>
      </div>
    `;
  }
}
