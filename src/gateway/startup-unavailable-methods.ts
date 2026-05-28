import { STARTUP_UNAVAILABLE_GATEWAY_METHODS } from "./methods/core-descriptors.js";

export function createStartupUnavailableGatewayMethods(params?: {
  enabled?: boolean;
}): Set<string> {
  if (params?.enabled === false) {
    return new Set();
  }
  return new Set(STARTUP_UNAVAILABLE_GATEWAY_METHODS);
}

export function markStartupUnavailableGatewayMethodsReady(methods: Set<string>): void {
  for (const method of STARTUP_UNAVAILABLE_GATEWAY_METHODS) {
    methods.delete(method);
  }
}
