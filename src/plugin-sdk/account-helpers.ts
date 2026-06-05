export {
  createAccountListHelpers,
  describeAccountSnapshot,
  mergeAccountConfig,
  resolveMergedAccountConfig,
} from "../channels/plugins/account-helpers.js";
export { createAccountActionGate } from "../channels/plugins/account-action-gate.js";

export function hasConfiguredAccountValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return Boolean(value && typeof value === "object");
}
