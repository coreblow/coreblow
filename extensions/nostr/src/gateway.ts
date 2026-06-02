import { nostrPlugin } from "./channel.js";

export const startNostrGatewayAccount = nostrPlugin.gateway?.startAccount;
export {
  getActiveNostrBuses,
  getNostrMetrics,
  getNostrProfileState,
  publishNostrProfile,
} from "./channel.js";
