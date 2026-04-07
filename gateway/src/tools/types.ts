/**
 * src/tools/types.ts
 * Tool type definitions
 */

export interface ToolHandler {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}
