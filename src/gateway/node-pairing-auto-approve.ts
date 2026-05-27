import { isTrustedProxyAddress } from "./net.js";

export type NodePairingAutoApproveReason =
  | "not-paired"
  | "role-upgrade"
  | "scope-upgrade"
  | "metadata-upgrade";

type NodePairingAutoApproveClientIpSource =
  | "direct"
  | "trusted-proxy"
  | "loopback-trusted-proxy"
  | "none";

export function resolveNodePairingClientIpSource(params: {
  reportedClientIp?: string;
  hasProxyHeaders: boolean;
  remoteIsTrustedProxy: boolean;
  remoteIsLoopback: boolean;
}): NodePairingAutoApproveClientIpSource {
  if (!params.reportedClientIp) {
    return "none";
  }
  if (!params.hasProxyHeaders || !params.remoteIsTrustedProxy) {
    return "direct";
  }
  return params.remoteIsLoopback ? "loopback-trusted-proxy" : "trusted-proxy";
}

export function shouldAutoApproveNodePairingFromTrustedCidrs(params: {
  existingPairedDevice: boolean;
  role: string;
  reason: NodePairingAutoApproveReason;
  scopes: readonly string[];
  hasBrowserOriginHeader: boolean;
  isControlUi: boolean;
  isWebchat: boolean;
  reportedClientIpSource: NodePairingAutoApproveClientIpSource;
  reportedClientIp?: string;
  autoApproveCidrs?: readonly string[];
}): boolean {
  if (params.existingPairedDevice) {
    return false;
  }
  if (params.role !== "node" || params.reason !== "not-paired") {
    return false;
  }
  if (params.scopes.length > 0) {
    return false;
  }
  if (params.hasBrowserOriginHeader || params.isControlUi || params.isWebchat) {
    return false;
  }
  if (
    params.reportedClientIpSource === "none" ||
    params.reportedClientIpSource === "loopback-trusted-proxy" ||
    !params.reportedClientIp
  ) {
    return false;
  }

  const cidrs = params.autoApproveCidrs
    ?.map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (!cidrs || cidrs.length === 0) {
    return false;
  }

  return isTrustedProxyAddress(params.reportedClientIp, cidrs);
}
