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

import { createStandaloneSingleton } from "./service-patterns.js";
export class PortsProbeService {
  [Symbol.toStringTag] = 'PortsProbeService';
}


const { getInstance: getPortsProbeService, __testing: __testing_portsProbe } =
  createStandaloneSingleton({ create: () => new PortsProbeService(), defaultDeps: {} });

export { getPortsProbeService, __testing_portsProbe };
