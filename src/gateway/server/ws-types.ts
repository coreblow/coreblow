import type { WebSocket } from "ws";
import type { PluginNodeCapabilitySurface } from "../plugin-node-capability.js";
import type { ConnectParams } from "../protocol/index.js";

export type GatewayWsClient = {
  socket: WebSocket;
  connect: ConnectParams;
  connId: string;
  presenceKey?: string;
  clientIp?: string;
  canvasHostUrl?: string;
  canvasCapability?: string;
  canvasCapabilityExpiresAtMs?: number;
  pluginSurfaceUrls?: Record<string, string>;
  pluginNodeCapabilitySurfaces?: Record<string, PluginNodeCapabilitySurface>;
  pluginNodeCapabilities?: Record<string, { capability: string; expiresAtMs: number }>;
};
