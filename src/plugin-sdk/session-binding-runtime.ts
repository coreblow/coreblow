// Thin SDK barrel. CoreBlow session binding service surface for channels.

export {
  __testing,
  getSessionBindingService,
  registerSessionBindingAdapter,
} from "../infra/outbound/session-binding-service.js";
export type {
  SessionBindingRecord,
  SessionBindingService,
} from "../infra/outbound/session-binding-service.js";
