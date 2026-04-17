/**
 * views/tool-approval-modal.ts
 * Full modal for tool execution approval.
 * Follows CoreBlow's exec.approval pattern.
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export type ToolApprovalEntry = {
   id: string;
   toolCallId: string;
   sessionKey: string;
   name: string;
   args?: unknown;
   riskLevel: "low" | "medium" | "high";
   expiresAtMs: number;
   requestedAt: number;
};

export type ApprovalDecision = "approve" | "deny";

@customElement("coreblow-tool-approval-modal")
export class ToolApprovalModal extends LitElement {
   @property({ attribute: false }) entry: ToolApprovalEntry | null = null;
   @property({ attribute: false }) onDecision!: (id: string, decision: ApprovalDecision) => void;
   @property({ type: Boolean }) alwaysApprove = false;

   createRenderRoot() { return this; }

   private get timeLeft(): number {
      if (!this.entry) return 0;
      return Math.max(0, Math.round((this.entry.expiresAtMs - Date.now()) / 1000));
   }

   private getRiskBadge() {
      if (!this.entry) return "";
      const map = { low: "🟢 LOW", medium: "🟡 MEDIUM", high: "🔴 HIGH" };
      return map[this.entry.riskLevel] ?? "🟡 MEDIUM";
   }

   private formatArgs(): string {
      if (!this.entry?.args) return "{}";
      try {
         const str = typeof this.entry.args === "string" ? this.entry.args : JSON.stringify(this.entry.args, null, 2);
         return str.length > 800 ? str.slice(0, 800) + "\n…" : str;
      } catch { return String(this.entry.args); }
   }

   private handleApprove() {
      if (this.entry) this.onDecision(this.entry.id, "approve");
   }

   private handleDeny() {
      if (this.entry) this.onDecision(this.entry.id, "deny");
   }

   connectedCallback() {
      super.connectedCallback();
      // Update timer every second
      this._timer = window.setInterval(() => this.requestUpdate(), 1000);
   }

   disconnectedCallback() {
      super.disconnectedCallback();
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
   }

   private _timer: number | null = null;

   render() {
      if (!this.entry) return html``;

      return html`
         <div class="approval-overlay" @click=${this.handleDeny}>
            <div class="approval-modal" @click=${(e: Event) => e.stopPropagation()}>

               <div class="approval-header">
                  <span class="approval-icon">🔒</span>
                  <span class="approval-title">Tool Approval Required</span>
               </div>

               <div class="approval-body">
                  <div class="approval-field">
                     <span class="approval-label">Tool</span>
                     <span class="approval-value approval-tool-name">${this.entry.name}</span>
                  </div>

                  <div class="approval-field">
                     <span class="approval-label">Risk</span>
                     <span class="approval-value">${this.getRiskBadge()}</span>
                  </div>

                  <div class="approval-field">
                     <span class="approval-label">Session</span>
                     <span class="approval-value" style="font-size: 11px; opacity: 0.7;">${this.entry.sessionKey.slice(0, 16)}…</span>
                  </div>

                  <div class="approval-args">
                     <details open>
                        <summary>Arguments</summary>
                        <pre>${this.formatArgs()}</pre>
                     </details>
                  </div>

                  <div class="approval-expiry">
                     Expires in: <strong>${this.timeLeft}s</strong>
                  </div>
               </div>

               <div class="approval-actions">
                  <button class="btn approval-deny" @click=${this.handleDeny}>Deny</button>
                  <button class="btn approval-approve" @click=${this.handleApprove}>Approve ✓</button>
               </div>
            </div>
         </div>
      `;
   }
}
