import type { CoreBlowApp } from "../app.ts";

export class HealthController {
   private pollTimer: ReturnType<typeof setInterval> | null = null;

   constructor(private app: CoreBlowApp) {}

   start() {
       this.poll();
       this.pollTimer = setInterval(() => this.poll(), 15000);
   }

   stop() {
       if (this.pollTimer) {
           clearInterval(this.pollTimer);
           this.pollTimer = null;
       }
   }

   async poll() {
       const client = this.app.gateway.getClient();
       if (!client || !client.connected) return;

       try {
           const health = await client.request<any>("health.snapshot");
           if (health && health.sessions) {
               this.app.sessionsCount = health.sessions.count;
           }
       } catch (err) {
           console.warn("Health poll failed", err);
       }
   }
}
