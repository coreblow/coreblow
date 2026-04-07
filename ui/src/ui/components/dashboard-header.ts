import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("coreblow-dashboard-header")
export class DashboardHeader extends LitElement {
    @property({ type: String }) title = "";

    static styles = css`
        :host {
           display: block;
           padding-bottom: 24px;
           border-bottom: 1px solid var(--border);
           margin-bottom: 24px;
        }
        h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: var(--text);
            letter-spacing: -0.02em;
        }
    `;

    render() {
        return html`<h1>${this.title}</h1>`;
    }
}
