export type DeliveryIntentRef = {
  readonly pluginId?: string;
  readonly channel?: string;
  readonly action?: string;
};

export type { DeliveryContext, DeliveryContextSessionSource } from "./delivery-context.js";
