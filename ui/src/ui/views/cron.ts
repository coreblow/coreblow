import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

type CronJob = {
   id: string;
   name: string;
   schedule: string;
   enabled: boolean;
   lastRun?: number;
   nextRun?: number;
   runCount: number;
   status: "idle" | "running" | "error";
};

@customElement("coreblow-cron-view")
export class CronView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() jobs: CronJob[] = [];
  @state() loading = false;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadJobs();
  }

  private async loadJobs() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const res = await client.request<{ jobs: CronJob[] }>("cron.list", {}).catch(() => null);
         this.jobs = res?.jobs ?? [];
      } catch { this.jobs = []; }
      this.loading = false;
  }

  private async toggleJob(id: string, enabled: boolean) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("cron.patch", { id, enabled }).catch(() => {});
      this.loadJobs();
  }

  private async triggerJob(id: string) {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      await client.request("cron.trigger", { id }).catch(() => {});
      this.app.addEventLog(`[CRON] Triggered job ${id}`);
      this.loadJobs();
  }

  private formatTime(ts?: number): string {
      if (!ts) return "—";
      const diff = Date.now() - ts;
      if (diff < 60_000) return "just now";
      if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
      return new Date(ts).toLocaleDateString();
  }

  private statusDot(status: string) {
      const color = status === "running" ? "var(--warning, #f59e0b)" : status === "error" ? "var(--destructive, #ef4444)" : "var(--success, #22c55e)";
      return html`<span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; ${status === 'running' ? 'animation: toolPulse 1.5s ease-in-out infinite;' : ''}"></span>`;
  }

  render() {
    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

         <div class="card">
            <div style="display: flex; align-items: center; gap: 12px;">
               <div style="flex: 1;">
                  <div class="card-title">⏰ Cron Jobs</div>
                  <div class="card-sub">${this.jobs.length} scheduled job${this.jobs.length !== 1 ? "s" : ""}</div>
               </div>
               <button style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
                @click=${() => this.loadJobs()}>↻ Refresh</button>
            </div>
         </div>

         ${this.loading ? html`<div style="text-align: center; padding: 40px; color: var(--muted);">Loading cron jobs...</div>` : ""}

         ${!this.loading && this.jobs.length === 0 ? html`
            <div class="card" style="text-align: center; padding: 40px;">
               <div style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;">⏰</div>
               <div style="color: var(--muted);">No cron jobs configured</div>
               <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Cron jobs are defined in the gateway configuration</div>
            </div>
         ` : ""}

         ${this.jobs.length > 0 ? html`
            <div class="card" style="padding: 0; overflow: hidden;">
               <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                     <tr style="background: var(--bg-elevated); border-bottom: 1px solid var(--border);">
                        <th style="padding: 10px 12px; text-align: left; color: var(--muted);">Status</th>
                        <th style="padding: 10px 12px; text-align: left; color: var(--muted);">Name</th>
                        <th style="padding: 10px 12px; text-align: left; color: var(--muted);">Schedule</th>
                        <th style="padding: 10px 12px; text-align: center; color: var(--muted);">Runs</th>
                        <th style="padding: 10px 12px; text-align: right; color: var(--muted);">Last Run</th>
                        <th style="padding: 10px 12px; text-align: center; color: var(--muted);">Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${this.jobs.map(job => html`
                        <tr style="border-bottom: 1px solid var(--border); ${!job.enabled ? 'opacity: 0.5;' : ''}">
                           <td style="padding: 10px 12px;">${this.statusDot(job.status)}</td>
                           <td style="padding: 10px 12px; font-weight: 600;">${job.name || job.id}</td>
                           <td style="padding: 10px 12px; font-family: var(--mono); font-size: 12px; color: var(--accent);">${job.schedule}</td>
                           <td style="padding: 10px 12px; text-align: center;">${job.runCount}</td>
                           <td style="padding: 10px 12px; text-align: right; font-size: 12px; color: var(--muted);">${this.formatTime(job.lastRun)}</td>
                           <td style="padding: 10px 12px; text-align: center;">
                              <div style="display: flex; gap: 4px; justify-content: center;">
                                 <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: var(--foreground);"
                                  @click=${() => this.triggerJob(job.id)} title="Run now">▶️</button>
                                 <button style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 11px; color: ${job.enabled ? 'var(--warning)' : 'var(--success)'};"
                                  @click=${() => this.toggleJob(job.id, !job.enabled)} title="${job.enabled ? 'Disable' : 'Enable'}">
                                    ${job.enabled ? "⏸" : "▶"}
                                 </button>
                              </div>
                           </td>
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
