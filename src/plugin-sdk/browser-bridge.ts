import type { Server } from "node:http";
import {
  startBrowserBridgeServer as startBridge,
  stopBrowserBridgeServer as stopBridge,
  type BrowserBridge,
} from "../../extensions/browser/src/browser/bridge-server.js";
import type { ResolvedBrowserConfig } from "./browser-profiles.js";

export type { BrowserBridge };

export async function startBrowserBridgeServer(params: {
  resolved: ResolvedBrowserConfig;
  host?: string;
  port?: number;
  authToken?: string;
  authPassword?: string;
  onEnsureAttachTarget?: (profile: unknown) => Promise<void>;
  resolveSandboxNoVncToken?: (token: string) => { noVncPort: number; password?: string } | null;
}): Promise<BrowserBridge> {
  return await startBridge(params as Parameters<typeof startBridge>[0]);
}

export async function stopBrowserBridgeServer(server: Server): Promise<void> {
  await stopBridge(server);
}
