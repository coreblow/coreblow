import crypto from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { isTruthyEnvValue } from "../infra/env.js";
import { logDebug } from "../logger.js";
import {
  clearActiveMcpLoopbackRuntimeByOwnerToken,
  setActiveMcpLoopbackRuntime,
} from "./mcp-http.loopback-runtime.js";
import { validateMcpLoopbackRequest } from "./mcp-http.request-validate.js";

export {
  createMcpLoopbackServerConfig,
  getActiveMcpLoopbackRuntime,
  resolveMcpLoopbackBearerToken,
} from "./mcp-http.loopback-runtime.js";

type McpLoopbackServer = {
  port: number;
  close: () => Promise<void>;
};

let activeMcpLoopbackServer: McpLoopbackServer | undefined;
let activeMcpLoopbackServerPromise: Promise<McpLoopbackServer> | null = null;

function shouldLogMcpLoopbackTraffic(): boolean {
  return (
    isTruthyEnvValue(process.env.COREBLOW_CLI_BACKEND_LOG_OUTPUT) ||
    isTruthyEnvValue(process.env.COREBLOW_LIVE_CLI_BACKEND_DEBUG)
  );
}

function logMcpLoopbackTraffic(step: string, details: Record<string, unknown>): void {
  if (!shouldLogMcpLoopbackTraffic()) {
    return;
  }
  console.error(`[mcp-loopback] ${step} ${JSON.stringify(details)}`);
}

function createRequestAbortSignal(req: IncomingMessage, res: ServerResponse) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  const abortIfRequestIncomplete = () => {
    if (!req.complete) {
      abort();
    }
  };
  const abortIfResponseStillOpen = () => {
    if (!res.writableEnded) {
      abort();
    }
  };
  req.once("close", abortIfRequestIncomplete);
  res.once("close", abortIfResponseStillOpen);
  if (req.destroyed && !req.complete) {
    abort();
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      req.off("close", abortIfRequestIncomplete);
      res.off("close", abortIfResponseStillOpen);
    },
  };
}

export async function startMcpLoopbackServer(port = 0): Promise<McpLoopbackServer> {
  const ownerToken = crypto.randomBytes(32).toString("hex");
  const nonOwnerToken = crypto.randomBytes(32).toString("hex");

  const httpServer = createHttpServer((req, res) => {
    const auth = validateMcpLoopbackRequest({ req, res, ownerToken, nonOwnerToken });
    if (!auth) {
      return;
    }

    const requestAbort = createRequestAbortSignal(req, res);
    void (async () => {
      try {
        const { dispatchMcpLoopbackRequest } = await import("./mcp-http.dispatcher.js");
        await dispatchMcpLoopbackRequest({
          req,
          res,
          auth,
          signal: requestAbort.signal,
          logTraffic: logMcpLoopbackTraffic,
        });
      } finally {
        requestAbort.cleanup();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "127.0.0.1", () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("mcp loopback did not bind to a TCP port");
  }
  setActiveMcpLoopbackRuntime({ port: address.port, ownerToken, nonOwnerToken });
  logDebug(`mcp loopback listening on 127.0.0.1:${address.port}`);

  const server: McpLoopbackServer = {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (!error) {
            clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken);
            if (activeMcpLoopbackServer === server) {
              activeMcpLoopbackServer = undefined;
            }
          }
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
  return server;
}

export async function ensureMcpLoopbackServer(port = 0): Promise<McpLoopbackServer> {
  if (activeMcpLoopbackServer) {
    return activeMcpLoopbackServer;
  }
  if (!activeMcpLoopbackServerPromise) {
    activeMcpLoopbackServerPromise = startMcpLoopbackServer(port)
      .then((server) => {
        activeMcpLoopbackServer = server;
        return server;
      })
      .finally(() => {
        activeMcpLoopbackServerPromise = null;
      });
  }
  return activeMcpLoopbackServerPromise;
}

export async function closeMcpLoopbackServer(): Promise<void> {
  const server =
    activeMcpLoopbackServer ??
    (activeMcpLoopbackServerPromise ? await activeMcpLoopbackServerPromise : undefined);
  if (!server) {
    return;
  }
  activeMcpLoopbackServer = undefined;
  await server.close();
}
