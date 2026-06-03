import type { IncomingMessage, ServerResponse } from "node:http";

export type { DiagnosticEventPayload } from "coreblow/plugin-sdk/compat";
export { onDiagnosticEvent } from "coreblow/plugin-sdk/compat";
export { redactSensitiveText } from "coreblow/plugin-sdk/diagnostics-otel";
export {
  emptyPluginConfigSchema,
  type CoreBlowPluginApi,
  type CoreBlowPluginService,
  type CoreBlowPluginServiceContext,
} from "coreblow/plugin-sdk/plugin-entry";

export type CoreBlowPluginHttpRouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean | void> | boolean | void;
