import type { CoreBlowConfig } from "../config/config.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../utils/message-channel.js";
import { buildGatewayConnectionDetails } from "./call.js";
import { GatewayClient, type GatewayClientOptions } from "./client.js";
import { resolveGatewayConnectionAuth } from "./connection-auth.js";
import { startGatewayClientWhenEventLoopReady } from "./client-start-readiness.js";

export async function createOperatorApprovalsGatewayClient(
  params: Pick<
    GatewayClientOptions,
    "clientDisplayName" | "onClose" | "onConnectError" | "onEvent" | "onHelloOk"
  > & {
    config: CoreBlowConfig;
    gatewayUrl?: string;
  },
): Promise<GatewayClient> {
  const { url: gatewayUrl, urlSource } = buildGatewayConnectionDetails({
    config: params.config,
    url: params.gatewayUrl,
  });
  const gatewayUrlOverrideSource =
    urlSource === "cli --url"
      ? "cli"
      : urlSource === "env COREBLOW_GATEWAY_URL"
        ? "env"
        : undefined;
  const auth = await resolveGatewayConnectionAuth({
    config: params.config,
    env: process.env,
    urlOverride: gatewayUrlOverrideSource ? gatewayUrl : undefined,
    urlOverrideSource: gatewayUrlOverrideSource,
  });

  return new GatewayClient({
    url: gatewayUrl,
    token: auth.token,
    password: auth.password,
    clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
    clientDisplayName: params.clientDisplayName,
    mode: GATEWAY_CLIENT_MODES.BACKEND,
    scopes: ["operator.approvals"],
    onEvent: params.onEvent,
    onHelloOk: params.onHelloOk,
    onConnectError: params.onConnectError,
    onClose: params.onClose,
  });
}

export async function withOperatorApprovalsGatewayClient<T>(
  params: {
    config: CoreBlowConfig;
    gatewayUrl?: string;
    clientDisplayName: string;
  },
  run: (client: GatewayClient) => Promise<T>,
): Promise<T> {
  let readySettled = false;
  let resolveReady!: () => void;
  let rejectReady!: (err: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const markReady = () => {
    if (readySettled) {
      return;
    }
    readySettled = true;
    resolveReady();
  };
  const failReady = (err: unknown) => {
    if (readySettled) {
      return;
    }
    readySettled = true;
    rejectReady(err);
  };

  const gatewayClient = await createOperatorApprovalsGatewayClient({
    config: params.config,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: params.clientDisplayName,
    onHelloOk: markReady,
    onConnectError: failReady,
    onClose: (code, reason) => {
      failReady(new Error(`gateway closed (${code}): ${reason}`));
    },
  });

  try {
    const readiness = await startGatewayClientWhenEventLoopReady(gatewayClient, {
      clientOptions: {
        preauthHandshakeTimeoutMs: params.config.gateway?.handshakeTimeoutMs,
      },
    });
    if (!readiness.ready) {
      throw new Error(
        readiness.aborted
          ? "gateway approval client start aborted before readiness"
          : "gateway readiness unavailable before approval client start",
      );
    }
    await ready;
    return await run(gatewayClient);
  } finally {
    await gatewayClient.stopAndWait().catch(() => {
      gatewayClient.stop();
    });
  }
}
