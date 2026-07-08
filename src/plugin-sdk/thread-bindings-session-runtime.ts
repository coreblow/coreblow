// Thin SDK barrel. CoreBlow thread-binding lifecycle and session-binding adapters.

export { resolveThreadBindingFarewellText } from "../channels/thread-bindings-messages.js";
export {
  resolveThreadBindingLifecycle,
  type ThreadBindingLifecycleRecord,
} from "../channels/thread-bindings-policy.js";
export {
  registerSessionBindingAdapter,
  unregisterSessionBindingAdapter,
  type BindingTargetKind,
  type SessionBindingAdapter,
  type SessionBindingRecord,
} from "../infra/outbound/session-binding-service.js";
