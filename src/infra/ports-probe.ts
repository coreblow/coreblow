import net from "node:net";

export async function tryListenOnPort(params: {
  port: number;
  host?: string;
  exclusive?: boolean;
}): Promise<void> {
  const listenOptions: net.ListenOptions = { port: params.port };
  if (params.host) {
    listenOptions.host = params.host;
  }
  if (typeof params.exclusive === "boolean") {
    listenOptions.exclusive = params.exclusive;
  }
  await new Promise<void>((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (err) => reject(err))
      .once("listening", () => {
        tester.close(() => resolve());
      })
      .listen(listenOptions);
  });
}

// ---------------------------------------------------------------------------
// PortsProbeService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class PortsProbeService {
  [Symbol.toStringTag] = 'PortsProbeService';
}

let _portsProbeInstance: PortsProbeService | null = null;

export function getPortsProbeService(): PortsProbeService {
  if (!_portsProbeInstance) {
    _portsProbeInstance = new PortsProbeService();
  }
  return _portsProbeInstance;
}

export const __testing_portsProbe = createTestingHooks<PortsProbeService>(
  () => { _portsProbeInstance = null; },
  (svc) => { _portsProbeInstance = svc; },
);
