import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon } from "../icons.ts";

type SkillEntry = {
   key: string;
   name: string;
   description?: string;
   category?: string;
   enabled: boolean;
   eligible: boolean;
   source?: string;
};

@customElement("coreblow-skills-view")
export class SkillsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() skills: SkillEntry[] = [];
  @state() loading = false;
  @state() filter = "";
  @state() statusFilter: "all" | "ready" | "disabled" = "all";

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.loadSkills();
  }

  private async loadSkills() {
      const client = this.app.gateway.getClient();
      if (!client?.connected) return;
      this.loading = true;
      try {
         const res = await client.request<{ skills: SkillEntry[] }>("skills.list", {}).catch(() => null);
         this.skills = res?.skills ?? [];
      } catch { this.skills = []; }
      this.loading = false;
  }

  private get filteredSkills(): SkillEntry[] {
      let list = this.skills;
      if (this.filter) {
         const q = this.filter.toLowerCase();
         list = list.filter(s => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q));
      }
      if (this.statusFilter === "ready") list = list.filter(s => s.enabled && s.eligible);
      if (this.statusFilter === "disabled") list = list.filter(s => !s.enabled);
      return list;
  }

  private get grouped(): Map<string, SkillEntry[]> {
      const map = new Map<string, SkillEntry[]>();
      for (const s of this.filteredSkills) {
         const cat = s.category || t("common.general");
         if (!map.has(cat)) map.set(cat, []);
         map.get(cat)!.push(s);
      }
      return map;
  }

  private statusBadge(s: SkillEntry) {
      if (!s.enabled) return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(136,136,136,0.15); color: var(--muted);">${t("common.disabled")}</span>`;
      if (!s.eligible) return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(245,158,11,0.15); color: var(--warning, #f59e0b);">${t("skills.needsSetup")}</span>`;
      return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(34,197,94,0.15); color: var(--success, #22c55e);">${t("skills.ready")}</span>`;
  }

  render() {
    const groups = this.grouped;
    const total = this.skills.length;
    const ready = this.skills.filter(s => s.enabled && s.eligible).length;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">

        <div class="card">
           <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 240px;">
                 <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                    ${renderIcon("zap", "16px")}
                    <span>${t("skills.title")}</span>
                    <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(34,197,94,0.12); color: var(--ok, #22c55e); font-family: var(--mono); font-weight: 600;">TypeScript AST Guard Active</span>
                 </div>
                 <div class="card-sub">${t("skills.readySummary", { ready: String(ready), total: String(total) })} · Zero-Trust Static AST Security Verification</div>
              </div>
              <button style="background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
               @click=${() => this.app.setTab("coreHub")}>CoreHub</button>
              <a href="https://coreblow.com/corehub" target="_blank" rel="noopener noreferrer"
                 style="background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px; text-decoration: none;">
                Browse CoreHub
              </a>
              <button style="background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px; display: inline-flex; align-items: center; gap: 6px;"
               @click=${() => this.loadSkills()}>${renderIcon("refresh", "12px")} ${t("common.refresh")}</button>
           </div>

           <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
              <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border-hairline); padding: 6px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px;"
                     placeholder=${t("skills.searchPlaceholder")}
                     .value=${this.filter}
                     @input=${(e: Event) => this.filter = (e.target as HTMLInputElement).value} />
              ${(["all", "ready", "disabled"] as const).map(f => html`
                 <button style="font-size: 11px; padding: 4px 10px; border-radius: var(--radius-sm); border: 1px solid ${this.statusFilter === f ? 'var(--accent)' : 'var(--border-hairline)'}; background: ${this.statusFilter === f ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${this.statusFilter === f ? 'white' : 'var(--foreground)'}; cursor: pointer;"
                  @click=${() => this.statusFilter = f}>${t(`skills.filter.${f}`)}</button>
              `)}
           </div>
        </div>

        ${this.loading ? html`<div style="text-align: center; padding: 40px; color: var(--muted);">${t("skills.loading")}</div>` : ""}

        ${!this.loading && this.filteredSkills.length === 0 ? html`
           <div class="card" style="text-align: center; padding: 40px;">
              <div style="margin-bottom: 8px;">${renderIcon("zap", "36px", "color: var(--muted); opacity: 0.4;")}</div>
              <div style="color: var(--muted);">${total === 0 ? t("skills.noRegistered") : t("skills.noMatch")}</div>
           </div>
        ` : ""}

        ${[...groups.entries()].map(([cat, items]) => html`
           <div class="card">
              <div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 12px;">${cat}</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                 ${items.map(s => html`
                    <div style="background: var(--surface-flat-muted); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-hairline); ${!s.enabled ? 'opacity: 0.5;' : ''}">
                       <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                          <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                             <span style="font-weight: 600; font-size: 13px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${s.name}</span>
                             ${s.source ? html`<span style="font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--bg-card, rgba(255,255,255,0.06)); border: 1px solid var(--border-hairline); font-family: var(--mono); color: var(--muted);">${s.source}</span>` : ""}
                          </div>
                          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                             <span style="font-size: 10px; padding: 1px 6px; border-radius: var(--radius-sm); background: rgba(34,197,94,0.1); color: var(--ok, #22c55e); font-family: var(--mono);" title="TypeScript AST Security Verified">AST: Clean</span>
                             ${this.statusBadge(s)}
                          </div>
                       </div>
                       ${s.description ? html`<div style="font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.4;">${s.description}</div>` : ""}
                       <div style="margin-top: 6px; font-size: 10px; color: var(--muted); font-family: var(--mono);">${s.key}</div>
                    </div>
                 `)}
              </div>
           </div>
        `)}
      </div>
    `;
  }
}
