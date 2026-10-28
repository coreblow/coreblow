import fs from "node:fs";
import path from "node:path";
import {
  buildChannelConfigSchema,
  buildJsonChannelConfigSchema,
} from "../channels/plugins/config-schema.js";
import type { ChannelConfigSchema } from "../channels/plugins/types.plugin.js";

export type BuiltChannelConfigSurface = ChannelConfigSchema;

export function isBuiltChannelConfigSchema(value: unknown): value is BuiltChannelConfigSurface {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { schema?: unknown };
  return Boolean(candidate.schema && typeof candidate.schema === "object");
}

export function resolveChannelConfigSurfaceExport(
  imported: Record<string, unknown>,
): BuiltChannelConfigSurface | null {
  for (const [name, value] of Object.entries(imported)) {
    if (name.endsWith("ChannelConfigSchema") && isBuiltChannelConfigSchema(value)) {
      return value;
    }
  }

  for (const [name, value] of Object.entries(imported)) {
    const lower = name.toLowerCase();
    if (!lower.endsWith("configschema") || lower.endsWith("accountconfigschema")) {
      continue;
    }
    if (isBuiltChannelConfigSchema(value)) {
      return value;
    }
    if (value && typeof value === "object") {
      if (typeof (value as { safeParse?: unknown }).safeParse === "function") {
        return buildChannelConfigSchema(value as never);
      }
      return buildJsonChannelConfigSchema(value as Record<string, unknown>);
    }
  }

  for (const value of Object.values(imported)) {
    if (isBuiltChannelConfigSchema(value)) {
      return value;
    }
  }

  return null;
}

export function resolveChannelConfigSchemaModulePath(rootDir: string): string | null {
  const candidates = [
    path.join(rootDir, "src", "config-schema.ts"),
    path.join(rootDir, "src", "config-schema.js"),
    path.join(rootDir, "src", "config-schema.mts"),
    path.join(rootDir, "src", "config-schema.mjs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
