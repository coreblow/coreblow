import type { JsonObject, ToolPlanEntry } from "./types.js";

export type ToolProtocolDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
};

export function toToolProtocolDescriptor(entry: ToolPlanEntry): ToolProtocolDescriptor {
  return {
    name: entry.descriptor.name,
    description: entry.descriptor.description,
    inputSchema: entry.descriptor.inputSchema,
  };
}

export function toToolProtocolDescriptors(
  entries: readonly ToolPlanEntry[],
): readonly ToolProtocolDescriptor[] {
  return entries.map(toToolProtocolDescriptor);
}
