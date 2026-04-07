import { CoreBlowApp } from "./app.ts";
import { GatewayBrowserClient, type GatewayEventFrame } from "./gateway.ts";
import type { ChatEventPayload, AgentEventPayload } from "./app-chat.ts";

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
           this.handleGatewayEvent(evt);
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

  // ─── Event Dispatch (OpenClaw pattern) ──────────────────────

  private handleGatewayEvent(evt: GatewayEventFrame) {
     // Log all events
     this.app.addEventLog(`[${evt.event}] ${JSON.stringify(evt.payload ?? {}).slice(0, 120)}`);

     if (evt.event === "chat") {
        this.app.chat.handleChatEvent(evt.payload as ChatEventPayload);
        return;
     }

     if (evt.event === "agent") {
        this.app.chat.handleAgentEvent(evt.payload as AgentEventPayload);
        return;
     }

     if (evt.event === "session.patch" || evt.event === "sessions.changed") {
        // Refresh session data
        this.requestInitialData();
        return;
     }

     if (evt.event === "shutdown") {
        this.app.addEventLog("Gateway shutting down...");
        this.app.connected = false;
        return;
     }
  }
  
  private async requestInitialData() {
     if (!this.client) return;
     try {
       const health = await this.client.request<{sessions?: {count?: number}}>("health.snapshot");
       this.app.sessionsCount = health?.sessions?.count || 0;
       
       const presence = await this.client.request<{entries: unknown[]}>("sys.presence");
       this.app.presenceCount = presence?.entries?.length || 0;
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : String(err);
       this.app.addEventLog(`Data fetch error: ${msg}`);
     }
  }
}
