import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

@customElement("coreblow-agents-view")
export class AgentsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() { return this; }
  
  connectedCallback() {
      super.connectedCallback();
      this.app.agentsController.fetch();
  }

  render() {
    const agents = this.app.agentsController.agents || [];
    
    return html`
      <div class="card">
         <div class="card-title">AI Agents Registry</div>
         <div class="card-sub">Loaded agents and their capabilities</div>
         
         <div style="margin-top: 24px; display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
             ${agents.length === 0 ? html`<div style="color:var(--muted)">No agents found...</div>` : agents.map((a: any) => html`
                 <div style="background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-sm);">
                     <div style="font-weight:600; display:flex; align-items:center; gap:8px;">
                         ${a.avatar || "🤖"} ${a.name || a.id}
                     </div>
                     <div style="font-size:12px; color:var(--muted); margin-top:8px;">ID: ${a.id}</div>
                     <p style="font-size:13px; margin-top:12px; color:var(--text);">${a.description || 'No description available.'}</p>
                 </div>
             `)}
         </div>
      </div>
    `;
  }
}
