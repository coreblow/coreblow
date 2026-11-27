import net from "node:net";

export interface AgentToAgentPolicyConfig {
  readonly enabled?: boolean;
  readonly allow?: readonly string[];
}

export interface SafeA2aUrlOptions {
  readonly allowPrivateNetworkForTest?: boolean;
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bxoxb-[A-Za-z0-9_-]{10,}\b/g,
  /\bAIza[0-9A-Za-z-_]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}\b/gi,
  /-----BEGIN\s+[^\n]*PRIVATE\s+KEY-----[\s\S]*?-----END\s+[^\n]*PRIVATE\s+KEY-----/gi,
];

export function redactA2aOutboundText(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  return false;
}

export function assertSafeA2aUrl(rawUrl: string, options?: SafeA2aUrlOptions): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`SSRF_BLOCKED: Invalid URL '${rawUrl}'`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("SSRF_BLOCKED: URLs with embedded credentials are not allowed");
  }

  const allowPrivate = options?.allowPrivateNetworkForTest === true;
  if (parsed.protocol !== "https:" && !(allowPrivate && parsed.protocol === "http:")) {
    throw new Error(`SSRF_BLOCKED: Disallowed URL protocol '${parsed.protocol}' (https required)`);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!allowPrivate) {
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      throw new Error(`SSRF_BLOCKED: Private or local hostname '${host}' is not allowed`);
    }
    const ipVersion = net.isIP(host);
    if (ipVersion === 4 && isPrivateIpv4(host)) {
      throw new Error(`SSRF_BLOCKED: Private or link-local IPv4 '${host}' is not allowed`);
    }
    if (ipVersion === 6 && isPrivateIpv6(host)) {
      throw new Error(`SSRF_BLOCKED: Private or loopback IPv6 '${host}' is not allowed`);
    }
  }

  return parsed;
}

export function assertA2aPolicyAllowed(
  policy: AgentToAgentPolicyConfig | undefined,
  targetAgentId: string,
): void {
  if (policy?.enabled !== true) {
    throw new Error("A2A_POLICY_DISABLED: tools.agentToAgent.enabled must be true for outbound A2A calls");
  }
  const allow = policy.allow?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  if (allow.length > 0 && !allow.includes("*") && !allow.includes(targetAgentId)) {
    throw new Error(
      `A2A_POLICY_TARGET_DENIED: target agent '${targetAgentId}' is not in tools.agentToAgent.allow`,
    );
  }
}
