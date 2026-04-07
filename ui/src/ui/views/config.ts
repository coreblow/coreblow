import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

@customElement("coreblow-config-view")
export class ConfigView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() { return this; }
  
  connectedCallback() {
      super.connectedCallback();
      this.app.configController.fetch();
  }

  render() {
    return html`
      <div class="card">
         <div class="card-title">Server Configuration</div>
         <div class="card-sub">Global configuration snapshot</div>
         
         ${!this.app.configController.config ? html`<div style="margin-top: 16px; color: var(--muted)">Loading config...</div>` : html`
            <pre style="margin-top: 16px; background: var(--bg-elevated); padding: 16px; border-radius: var(--radius-sm); color: var(--muted); font-family: var(--mono); font-size: 13px; overflow-x: auto;">
${JSON.stringify(this.app.configController.config, null, 2)}
            </pre>
         `}
      </div>
    `;
  }
}
