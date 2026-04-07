import type { CoreBlowApp } from "../app.ts";

export class AgentsController {
   agents: any[] = [];
   
   constructor(private app: CoreBlowApp) {}
   
   async fetch() {
      const client = this.app.gateway.getClient();
      if (!client || !client.connected) return;
      try {
         const res = await client.request<any>("agent.search", { query: "" });
         this.agents = res?.agents || [];
         this.app.requestUpdate();
      } catch (err: any) {
         console.warn("Failed to fetch agents", err.message);
      }
   }
}
