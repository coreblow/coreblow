import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

@customElement("coreblow-sessions-view")
export class SessionsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() { return this; }

  connectedCallback() {
      super.connectedCallback();
      this.app.sessionsController.fetch();
  }

  render() {
    const sessions = this.app.sessionsController.sessions || [];
    
    return html`
      <div class="card">
         <div class="card-title">Sessions</div>
         <div class="card-sub">Manage active and historical AI sessions</div>
         
         <div style="margin-top: 24px; display:flex; flex-direction:column; gap:12px;">
             ${sessions.length === 0 ? html`<div style="color:var(--muted)">No sessions found...</div>` : sessions.map((s: any) => html`
                 <div style="background: var(--bg-elevated); padding: 12px; border-radius: var(--radius-sm); display:flex; justify-content: space-between; align-items:center;">
                     <div>
                        <div style="font-weight:600;">${s.label || s.key || "Unnamed Session"}</div>
                        <div style="font-size:12px; color:var(--muted)">ID: ${s.key} • Run Time: ${s.runtimeMs || 0}ms</div>
                     </div>
                     <span class="pill" style="font-size:12px;">${s.status || "idle"}</span>
                 </div>
             `)}
         </div>
      </div>
    `;
  }
}
