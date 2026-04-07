import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

@customElement("coreblow-overview-view")
export class OverviewView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  createRenderRoot() {
    return this; // use light DOM for shared css
  }

  render() {
    return html`
      <div class="grid" style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
        
        <div class="card">
          <div class="card-title">Gateway Connection</div>
          <div class="card-sub">WebSocket Settings</div>
          <div style="margin-top: 16px; display: grid; gap: 12px;">
            <label class="field">
               <span>URL</span>
               <input .value=${this.app.settings.gatewayUrl} 
                      @input=${(e: Event) => this.app.applySettings({...this.app.settings, gatewayUrl: (e.target as HTMLInputElement).value})}/>
            </label>
            <label class="field">
               <span>Token</span>
               <input type="password" .value=${this.app.settings.token} 
                      @input=${(e: Event) => this.app.applySettings({...this.app.settings, token: (e.target as HTMLInputElement).value})}/>
            </label>
            <button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;"
             @click=${() => this.app.gateway.reconnect()}>Connect to Gateway</button>
          </div>
        </div>
        
        <div class="card">
          <div class="card-title">System Status</div>
          <div class="card-sub">CoreBlow Snapshot</div>
          <div style="margin-top: 16px;" class="stat-grid">
              <div class="stat">
                <div class="stat-label">Active Sessions</div>
                <div class="stat-value">${this.app.sessionsCount}</div>
              </div>
              <div class="stat">
                <div class="stat-label">Online Peers</div>
                <div class="stat-value">${this.app.presenceCount}</div>
              </div>
          </div>
        </div>
        
      </div>
      
      <div style="margin-top: 24px;">
         <div class="card">
            <div class="card-title">Event Log</div>
            <div class="card-sub">Live coreblow streaming events</div>
            <pre style="margin-top: 12px; background: var(--bg-elevated); padding: 12px; border-radius: var(--radius-sm); color: var(--muted); font-family: var(--mono); font-size: 12px; min-height: 200px; max-height: 400px; overflow-y: auto;">
${this.app.eventLog.map(e => `[${new Date(e.ts).toLocaleTimeString()}] ${e.raw}`).join('\n')}
            </pre>
         </div>
      </div>
    `;
  }
}
