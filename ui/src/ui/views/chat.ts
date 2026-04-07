import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { CoreBlowApp } from "../app.ts";
import { renderMarkdown } from "../markdown.ts";

@customElement("coreblow-chat-view")
export class ChatView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @query("input.chat-input") inputEl!: HTMLInputElement;
  
  @state() inputText = "";

  createRenderRoot() {
    return this; // use light DOM for shared css
  }

  handleSend() {
     const text = this.inputText.trim();
     if (!text) return;
     this.inputText = "";
     this.app.chat.send(text);
  }

  handleKeyDown(e: KeyboardEvent) {
     if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
     }
  }

  render() {
    return html`
      <div class="chat-container">
         <div class="chat-history" style="flex: 1; overflow-y: auto; padding: var(--shell-pad); display: flex; flex-direction: column; gap: 16px;">
            ${this.app.chat.messages.length === 0 ? html`
               <div style="margin: auto; text-align: center; color: var(--muted); opacity: 0.6;">
                 <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                 <div>Send a message to CoreBlow</div>
               </div>
            ` : ""}
            
            ${this.app.chat.messages.map(msg => html`
              <div class="chat-message chat-message--${msg.role}" style="display: flex; gap: 12px; ${msg.role === 'user' ? 'flex-direction: row-reverse' : ''}">
                 <div class="chat-message-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: ${msg.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)'}; display:flex; align-items:center; justify-content:center;">
                    ${msg.role === 'user' ? "👤" : "🤖"}
                 </div>
                 <div class="chat-message-content" style="background: ${msg.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)'}; color: ${msg.role === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)'}; padding: 12px 16px; border-radius: var(--radius-md); max-width: 80%;">
                    ${msg.streaming && !msg.content ? html`<span class="typing-indicator" style="opacity:0.5">thinking...</span>` : unsafeHTML(renderMarkdown(msg.content))}
                 </div>
              </div>
            `)}
         </div>
         
         <div class="chat-input-area" style="padding: var(--shell-pad); border-top: 1px solid var(--border);">
             <div class="chat-input-box" style="display: flex; gap: 8px; background: var(--bg-elevated); padding: 8px; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <input class="chat-input" 
                       style="flex: 1; background: transparent; border: none; color: var(--text); padding: 8px; outline: none; font-family: var(--font-sans);"
                       placeholder="Message CoreBlow..."
                       .value=${this.inputText}
                       @input=${(e: Event) => this.inputText = (e.target as HTMLInputElement).value}
                       @keydown=${this.handleKeyDown}
                />
                <button class="btn" style="background: var(--accent); color: var(--primary-foreground); border:none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer;"
                 @click=${this.handleSend}>Send</button>
             </div>
         </div>
      </div>
    `;
  }
}
