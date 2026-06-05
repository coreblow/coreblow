import path from "node:path";
import { redactSensitiveText } from "./redact.js";

export type SupportRedactionContext = {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  workspaceDir?: string;
};

export function redactSupportString(value: string, _ctx?: SupportRedactionContext): string {
  return redactPathForSupport(value, _ctx);
}

export function sanitizeSupportSnapshotValue(
  value: unknown,
  _ctx?: SupportRedactionContext,
): unknown {
  if (typeof value === "string") {
    return redactSupportString(value, _ctx);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSupportSnapshotValue(entry, _ctx));
  }
  return value;
}

export function redactPathForSupport(value: string, ctx?: SupportRedactionContext): string {
  const home = ctx?.env?.HOME;
  let next = value;
  if (ctx?.workspaceDir && next.includes(ctx.workspaceDir)) {
    next = next.replaceAll(ctx.workspaceDir, "$WORKSPACE_DIR");
  }
  if (ctx?.stateDir && next.includes(ctx.stateDir)) {
    next = next.replaceAll(ctx.stateDir, "$COREBLOW_STATE_DIR");
  }
  if (home && next.startsWith(home)) {
    next = `~${next.slice(home.length)}`;
  }
  if (home && next.includes(home)) {
    next = next.replaceAll(home, "~");
  }
  return redactSensitiveText(next);
}
