// Narrow SSRF helpers for extensions that need pinned-dispatcher and policy
// utilities without loading the full infra-runtime surface.

export {
  closeDispatcher,
  createPinnedDispatcher,
  isBlockedHostnameOrIp,
  resolvePinnedHostname,
  resolvePinnedHostnameWithPolicy,
  type LookupFn,
  type SsrFPolicy,
} from "../infra/net/ssrf.js";
export { formatErrorMessage } from "../infra/errors.js";
export { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";
export {
  assertHttpUrlTargetsPrivateNetwork,
  buildHostnameAllowlistPolicyFromSuffixAllowlist,
  ssrfPolicyFromAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork as ssrfPolicyFromDangerouslyAllowPrivateNetwork,
} from "./ssrf-policy.js";

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export function mergeSsrFPolicies<TPolicy extends object>(
  ...policies: Array<TPolicy | undefined>
): TPolicy | undefined {
  return Object.assign({}, ...policies.filter(Boolean)) as TPolicy | undefined;
}
