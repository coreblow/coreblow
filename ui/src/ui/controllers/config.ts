import type { CoreBlowApp } from "../app.ts";

export class ConfigController {
   config: any = null;
   
   constructor(private app: CoreBlowApp) {}
   
   async fetch() {
      const client = this.app.gateway.getClient();
      if (!client || !client.connected) return;
      try {
         const res = await client.request<any>("sys.config", {});
         this.config = res?.config || {};
         this.app.requestUpdate();
      } catch (err: any) {
         console.warn("Failed to fetch config", err.message);
      }
   }
}
