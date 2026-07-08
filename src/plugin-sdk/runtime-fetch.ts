// Narrow runtime fetch helpers for plugins that need dispatcher-aware fetch.

export {
  closeDispatcher,
  createPinnedDispatcher,
  resolvePinnedHostnameWithPolicy,
} from "../infra/net/ssrf.js";
