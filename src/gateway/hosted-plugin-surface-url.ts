import { isLoopbackHost } from "./net.js";

type HostSource = string | null | undefined;

export type HostedPluginSurfaceUrlParams = {
  port?: number;
  hostOverride?: HostSource;
  forwardedHost?: HostSource | HostSource[];
  requestHost?: HostSource;
  forwardedProto?: HostSource | HostSource[];
  localAddress?: HostSource;
  scheme?: "http" | "https";
};

function normalizeHost(value: HostSource, rejectLoopback: boolean): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || (rejectLoopback && isLoopbackHost(trimmed))) {
    return "";
  }
  return trimmed;
}

type ParsedHostHeader = {
  host: string;
  port?: number;
};

function parseHostHeader(value: HostSource): ParsedHostHeader {
  if (!value) {
    return { host: "" };
  }
  try {
    const parsed = new URL(`http://${value.trim()}`);
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : undefined;
    return {
      host: parsed.hostname,
      port: Number.isFinite(port) ? port : undefined,
    };
  } catch {
    return { host: "" };
  }
}

function firstHeaderValue(value: HostSource | HostSource[]): HostSource {
  return Array.isArray(value) ? value[0] : value;
}

function parseForwardedHost(value: HostSource | HostSource[]): HostSource {
  return firstHeaderValue(value)?.split(",")[0]?.trim();
}

export function resolveHostedPluginSurfaceUrl(
  params: HostedPluginSurfaceUrlParams,
): string | undefined {
  if (!params.port) {
    return undefined;
  }

  const forwardedScheme = firstHeaderValue(params.forwardedProto)?.trim();
  const scheme = forwardedScheme === "https" ? "https" : (params.scheme ?? "http");
  const override = normalizeHost(params.hostOverride, true);
  const parsedForwardedHost = parseHostHeader(parseForwardedHost(params.forwardedHost));
  const parsedRequestHost = parseHostHeader(params.requestHost);
  const forwardedHost = normalizeHost(parsedForwardedHost.host, Boolean(override));
  const requestHost = normalizeHost(parsedRequestHost.host, Boolean(override));
  const advertisedHost = forwardedHost ? parsedForwardedHost : parsedRequestHost;
  const localAddress = normalizeHost(
    params.localAddress,
    Boolean(override || forwardedHost || requestHost),
  );
  const host = override || forwardedHost || requestHost || localAddress;
  if (!host) {
    return undefined;
  }

  let exposedPort = params.port;
  if (!override && (forwardedHost || requestHost) && params.port === 18789) {
    if (advertisedHost.port && advertisedHost.port > 0) {
      exposedPort = advertisedHost.port;
    } else {
      exposedPort = scheme === "https" ? 443 : 80;
    }
  }

  const formattedHost = host.includes(":") ? `[${host}]` : host;
  return `${scheme}://${formattedHost}:${exposedPort}`;
}
