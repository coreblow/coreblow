import type { CoreBlowApp } from "./app.ts";
import { generateUUID } from "./uuid.ts";

export type ChatMessage = {
   id: string;
   role: "user" | "assistant" | "system";
   content: string;
   ts: number;
   streaming?: boolean;
};

export class ChatController {
   messages: ChatMessage[] = [];
   sessionKey: string = this.app.settings.sessionKey || "";

   constructor(private app: CoreBlowApp) {}

   async send(text: string) {
       const msg: ChatMessage = { id: generateUUID(), role: "user", content: text, ts: Date.now() };
       this.messages = [...this.messages, msg];
       this.app.requestUpdate();

       const client = this.app.gateway.getClient();
       if (!client || !client.connected) {
          this.messages = [...this.messages, {
             id: generateUUID(), role: "system", ts: Date.now(),
             content: "Error: Not connected to Gateway."
          }];
          this.app.requestUpdate();
          return;
       }

       // Optimistic UI for assistant response
       const asstMsgId = generateUUID();
       let asstContent = "";
       this.messages = [...this.messages, {
           id: asstMsgId, role: "assistant", content: asstContent, streaming: true, ts: Date.now()
       }];
       this.app.requestUpdate();

       try {
           if (!this.sessionKey) {
               // In OpenClaw, direct messages w/o session will auto-create
               // For CoreBlow, we will resolve to basic prompt inference
           }
           
           // RPC `prompt.run` logic
           const res = await client.request<any>("prompt.run", {
               sessionKey: this.sessionKey || undefined,
               prompt: text
           });
           
           asstContent = res?.text || "No response received";
       } catch (err: any) {
           asstContent = `**RPC Error**: ${err.message}`;
       } finally {
           this.messages = this.messages.map(m => 
              m.id === asstMsgId ? { ...m, content: asstContent, streaming: false } : m
           );
           this.app.requestUpdate();
       }
   }
   
   clear() {
       this.messages = [];
       this.app.requestUpdate();
   }
}
