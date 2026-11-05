/**
 * views/tool-approval-modal.ts
 * Full modal for tool execution approval.
 * Follows CoreBlow's exec.approval pattern.
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { I18nController, t } from "../../i18n/index.ts";
import { renderIcon } from "../icons.ts";

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
   private i18nController = new I18nController(this);
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
      const level = this.entry.riskLevel ?? "medium";
      const color = level === "low" ? "var(--success, #22c55e)" : level === "high" ? "var(--destructive, #ef4444)" : "var(--warning, #f59e0b)";
      const bg = level === "low" ? "rgba(34,197,94,0.12)" : level === "high" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)";
      const label = level === "low" ? t("toolApproval.risk.low") : level === "high" ? t("toolApproval.risk.high") : t("toolApproval.risk.medium");
      return html`
         <span style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: ${color}; background: ${bg}; border: 1px solid ${color}33;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
            <span>${label}</span>
         </span>
      `;
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
                  <span class="approval-icon" style="display: inline-flex; align-items: center; justify-content: center;">${renderIcon("lock", "18px")}</span>
                  <span class="approval-title">${t("toolApproval.title")}</span>
               </div>

               <div class="approval-body">
                  <div class="approval-field">
                     <span class="approval-label">${t("toolApproval.tool")}</span>
                     <span class="approval-value approval-tool-name">${this.entry.name}</span>
                  </div>

                  <div class="approval-field">
                     <span class="approval-label">${t("toolApproval.risk.label")}</span>
                     <span class="approval-value">${this.getRiskBadge()}</span>
                  </div>

                  <div class="approval-field">
                     <span class="approval-label">${t("toolApproval.session")}</span>
                     <span class="approval-value" style="font-size: 11px; opacity: 0.7;">${this.entry.sessionKey.slice(0, 16)}…</span>
                  </div>

                  <div class="approval-args">
                     <details open>
                        <summary>${t("toolApproval.arguments")}</summary>
                        <pre>${this.formatArgs()}</pre>
                     </details>
                  </div>

                  <div class="approval-expiry">
                     ${t("toolApproval.expiresIn", { seconds: String(this.timeLeft) })}
                  </div>
               </div>

               <div class="approval-actions">
                  <button class="btn approval-deny" @click=${this.handleDeny}>${t("toolApproval.deny")}</button>
                  <button class="btn approval-approve" @click=${this.handleApprove}>${t("toolApproval.approve")}</button>
               </div>
            </div>
         </div>
      `;
   }
}
