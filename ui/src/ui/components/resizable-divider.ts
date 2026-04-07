import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("coreblow-resizable-divider")
export class ResizableDivider extends LitElement {
    static styles = css`
        :host {
           display: block;
           width: 4px;
           background: transparent;
           cursor: col-resize;
           transition: background 0.2s ease;
        }
        :host(:hover), :host(:active) {
            background: var(--accent);
            opacity: 0.5;
        }
    `;

    render() {
        return html`<div></div>`;
    }
}
