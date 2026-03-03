import type { CoreBlowApp } from "../app.ts";

export class SessionsController {
   sessions: any[] = [];

   constructor(private app: CoreBlowApp) {}

   async fetch() {
      const client = this.app.gateway.getClient();
      if (!client || !client.connected) return;
      try {
         const res = await client.request<any>("session.list", { limit: 50 });
         this.sessions = res?.sessions || [];
         this.app.requestUpdate();
      } catch (err: any) {
         console.warn("Failed to fetch sessions", err.message);
      }
   }
}
