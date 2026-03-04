/**
 * src/tools/types.ts
 * Tool type definitions
 */

export interface ToolHandler {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (args: Record<string, any>) => Promise<string>;
}
