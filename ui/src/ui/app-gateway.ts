import { CoreBlowApp } from "./app.ts";
import { GatewayBrowserClient } from "./gateway.ts";

export class GatewayController {
  private client: GatewayBrowserClient | null = null;
  
  constructor(private app: CoreBlowApp) {}
  
  start() {
     this.client = new GatewayBrowserClient({
        url: this.app.settings.gatewayUrl,
        token: this.app.settings.token,
        onHello: (hello) => {
           this.app.connected = true;
           this.app.addEventLog("Connected to Gateway Server");
           this.requestInitialData();
        },
        onEvent: (evt) => {
           if (evt.event === "session.patch") {
              // We'll wire this up later
           }
        },
        onClose: (info) => {
           this.app.connected = false;
           this.app.addEventLog(`Disconnected (${info.code})`);
        }
     });
     
     this.client.start();
  }
  
  stop() {
     this.client?.stop();
     this.client = null;
     this.app.connected = false;
  }
  
  reconnect() {
     this.stop();
     this.start();
  }
  
  getClient() {
     return this.client;
  }
  
  private async requestInitialData() {
     if (!this.client) return;
     try {
       // Request snapshot data
       const health = await this.client.request<any>("health.snapshot");
       this.app.sessionsCount = health?.sessions?.count || 0;
       
       const presence = await this.client.request<{entries: any[]}>("sys.presence");
       this.app.presenceCount = presence?.entries?.length || 0;
     } catch (err: any) {
       console.error("Failed to fetch initial data", err);
       this.app.addEventLog(`Data fetch error: ${err.message}`);
     }
  }
}
