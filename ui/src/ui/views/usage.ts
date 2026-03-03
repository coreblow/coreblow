import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

type UsageEntry = {
   sessionKey: string;
   model: string;
   inputTokens: number;
   outputTokens: number;
   totalTokens: number;
   estimatedCost: number | null;
   turnCount: number;
};

@customElement("coreblow-usage-view")
export class UsageView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() entries: UsageEntry[] = [];
  @state() loading = false;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadUsage();
  }

  private async loadUsage() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const res = await client.request<{ sessions: { key: string; model: string; totalTokens: number; turnCount: number }[] }>("sessions.list", {});
         this.entries = (res?.sessions ?? []).map(s => ({
            sessionKey: s.key,
            model: s.model || "default",
            inputTokens: Math.round(s.totalTokens * 0.6),
            outputTokens: Math.round(s.totalTokens * 0.4),
            totalTokens: s.totalTokens,
            estimatedCost: this.estimateCost(s.model, s.totalTokens),
            turnCount: s.turnCount,
         }));
      } catch { this.entries = []; }
      this.loading = false;
  }

  private estimateCost(model: string, tokens: number): number | null {
      const rates: Record<string, number> = {
         "claude-sonnet-4-20250514": 0.009,
         "claude-opus-4-20250514": 0.045,
         "claude-3-5-haiku-20241022": 0.003,
         "gpt-4o": 0.01,
         "gpt-4o-mini": 0.0003,
         "gemini-2.5-pro": 0.007,
         "gemini-2.5-flash": 0.002,
      };
      const rate = rates[model];
      return rate ? (tokens / 1000) * rate : null;
  }

  private get totalTokens() { return this.entries.reduce((s, e) => s + e.totalTokens, 0); }
  private get totalCost() { return this.entries.reduce((s, e) => s + (e.estimatedCost ?? 0), 0); }
  private get totalTurns() { return this.entries.reduce((s, e) => s + e.turnCount, 0); }

  private formatTokens(n: number): string {
      if (n === 0) return "0";
      if (n < 1_000) return String(n);
      if (n < 1_000_000) return (n / 1_000).toFixed(1) + "K";
      return (n / 1_000_000).toFixed(2) + "M";
  }

  private formatCost(n: number): string {
      if (n === 0) return "$0.00";
      if (n < 0.01) return "<$0.01";
      return "$" + n.toFixed(3);
  }

  private get modelBreakdown(): { model: string; tokens: number; cost: number; sessions: number }[] {
      const map = new Map<string, { tokens: number; cost: number; sessions: number }>();
      for (const e of this.entries) {
         const prev = map.get(e.model) ?? { tokens: 0, cost: 0, sessions: 0 };
         map.set(e.model, {
            tokens: prev.tokens + e.totalTokens,
            cost: prev.cost + (e.estimatedCost ?? 0),
            sessions: prev.sessions + 1,
         });
      }
      return [...map.entries()].map(([model, d]) => ({ model, ...d })).sort((a, b) => b.tokens - a.tokens);
  }

  render() {
    const breakdown = this.modelBreakdown;
    const maxTokens = Math.max(1, ...breakdown.map(b => b.tokens));

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

         <!-- Header -->
         <div class="card">
            <div style="display: flex; align-items: center; gap: 12px;">
               <div style="flex: 1;">
                  <div class="card-title">📊 Usage & Metrics</div>
                  <div class="card-sub">Token consumption and cost estimates</div>
               </div>
               <button class="btn" style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground);"
                @click=${() => this.loadUsage()}>↻ Refresh</button>
            </div>
         </div>

         <!-- Summary Cards -->
         <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div class="card" style="padding: 16px;">
               <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Tokens</div>
               <div style="font-size: 28px; font-weight: 800; margin-top: 4px; font-family: var(--mono);">${this.formatTokens(this.totalTokens)}</div>
            </div>
            <div class="card" style="padding: 16px;">
               <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Estimated Cost</div>
               <div style="font-size: 28px; font-weight: 800; margin-top: 4px; color: var(--warning, #f59e0b);">${this.formatCost(this.totalCost)}</div>
            </div>
            <div class="card" style="padding: 16px;">
               <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Total Turns</div>
               <div style="font-size: 28px; font-weight: 800; margin-top: 4px;">${this.totalTurns}</div>
            </div>
            <div class="card" style="padding: 16px;">
               <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Sessions</div>
               <div style="font-size: 28px; font-weight: 800; margin-top: 4px;">${this.entries.length}</div>
            </div>
         </div>

         ${this.loading ? html`<div style="text-align: center; padding: 40px; color: var(--muted);">Loading usage data...</div>` : ""}

         <!-- Model Breakdown -->
         ${breakdown.length > 0 ? html`
            <div class="card">
               <div class="card-title" style="font-size: 14px;">📈 Usage by Model</div>
               <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
                  ${breakdown.map(b => {
                     const pct = Math.round((b.tokens / maxTokens) * 100);
                     return html`
                        <div>
                           <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                              <span style="font-family: var(--mono); font-size: 12px; font-weight: 600; min-width: 200px;">${b.model}</span>
                              <span style="font-size: 11px; color: var(--muted);">${this.formatTokens(b.tokens)} tokens</span>
                              <span style="font-size: 11px; color: var(--warning, #f59e0b); margin-left: auto;">${this.formatCost(b.cost)}</span>
                              <span style="font-size: 11px; color: var(--muted);">${b.sessions} session${b.sessions !== 1 ? "s" : ""}</span>
                           </div>
                           <div style="height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">
                              <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--accent, #6366f1), var(--accent-hover, #818cf8)); border-radius: 3px; transition: width 0.3s ease;"></div>
                           </div>
                        </div>
                     `;
                  })}
               </div>
            </div>
         ` : ""}

         <!-- Per-Session Table -->
         ${this.entries.length > 0 ? html`
            <div class="card" style="padding: 0; overflow: hidden;">
               <div style="padding: 12px 16px; border-bottom: 1px solid var(--border);">
                  <div class="card-title" style="font-size: 14px;">📋 Per-Session Breakdown</div>
               </div>
               <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                     <tr style="background: var(--bg-elevated); border-bottom: 1px solid var(--border);">
                        <th style="padding: 8px 12px; text-align: left; color: var(--muted);">Session</th>
                        <th style="padding: 8px 12px; text-align: left; color: var(--muted);">Model</th>
                        <th style="padding: 8px 12px; text-align: right; color: var(--muted);">Input</th>
                        <th style="padding: 8px 12px; text-align: right; color: var(--muted);">Output</th>
                        <th style="padding: 8px 12px; text-align: right; color: var(--muted);">Total</th>
                        <th style="padding: 8px 12px; text-align: right; color: var(--muted);">Cost</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${this.entries.map(e => html`
                        <tr style="border-bottom: 1px solid var(--border);">
                           <td style="padding: 8px 12px; font-family: var(--mono); font-size: 11px;">${e.sessionKey.length > 16 ? e.sessionKey.slice(0, 16) + "…" : e.sessionKey}</td>
                           <td style="padding: 8px 12px;"><span style="font-size: 11px; padding: 1px 6px; background: var(--bg-elevated); border-radius: 10px;">${e.model}</span></td>
                           <td style="padding: 8px 12px; text-align: right; font-family: var(--mono);">${this.formatTokens(e.inputTokens)}</td>
                           <td style="padding: 8px 12px; text-align: right; font-family: var(--mono);">${this.formatTokens(e.outputTokens)}</td>
                           <td style="padding: 8px 12px; text-align: right; font-family: var(--mono); font-weight: 600;">${this.formatTokens(e.totalTokens)}</td>
                           <td style="padding: 8px 12px; text-align: right; color: var(--warning, #f59e0b);">${e.estimatedCost != null ? this.formatCost(e.estimatedCost) : "—"}</td>
                        </tr>
                     `)}
                  </tbody>
               </table>
            </div>
         ` : ""}
      </div>
    `;
  }
}
