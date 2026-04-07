import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

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
         const cat = s.category || "General";
         if (!map.has(cat)) map.set(cat, []);
         map.get(cat)!.push(s);
      }
      return map;
  }

  private statusBadge(s: SkillEntry) {
      if (!s.enabled) return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(136,136,136,0.15); color: var(--muted);">disabled</span>`;
      if (!s.eligible) return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(245,158,11,0.15); color: var(--warning, #f59e0b);">needs setup</span>`;
      return html`<span style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(34,197,94,0.15); color: var(--success, #22c55e);">ready</span>`;
  }

  render() {
    const groups = this.grouped;
    const total = this.skills.length;
    const ready = this.skills.filter(s => s.enabled && s.eligible).length;

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <div class="card">
           <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1;">
                 <div class="card-title">⚡ Skills</div>
                 <div class="card-sub">${ready} of ${total} skills ready</div>
              </div>
              <button style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
               @click=${() => this.loadSkills()}>↻ Refresh</button>
           </div>

           <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
              <input style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border); padding: 6px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px;"
                     placeholder="Search skills..."
                     .value=${this.filter}
                     @input=${(e: Event) => this.filter = (e.target as HTMLInputElement).value} />
              ${(["all", "ready", "disabled"] as const).map(f => html`
                 <button style="font-size: 11px; padding: 4px 10px; border-radius: var(--radius-sm); border: 1px solid ${this.statusFilter === f ? 'var(--accent)' : 'var(--border)'}; background: ${this.statusFilter === f ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${this.statusFilter === f ? 'white' : 'var(--foreground)'}; cursor: pointer;"
                  @click=${() => this.statusFilter = f}>${f}</button>
              `)}
           </div>
        </div>

        ${this.loading ? html`<div style="text-align: center; padding: 40px; color: var(--muted);">Loading skills...</div>` : ""}

        ${!this.loading && this.filteredSkills.length === 0 ? html`
           <div class="card" style="text-align: center; padding: 40px;">
              <div style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;">⚡</div>
              <div style="color: var(--muted);">${total === 0 ? "No skills registered" : "No skills match filter"}</div>
           </div>
        ` : ""}

        ${[...groups.entries()].map(([cat, items]) => html`
           <div class="card">
              <div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 12px;">${cat}</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                 ${items.map(s => html`
                    <div style="background: var(--bg-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); ${!s.enabled ? 'opacity: 0.5;' : ''}">
                       <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-weight: 600; font-size: 13px;">${s.name}</span>
                          ${this.statusBadge(s)}
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
