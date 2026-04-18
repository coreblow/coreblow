/** CoreBlow — Types: Tools */ export interface ToolConfig { name: string; enabled: boolean; approval?: "auto" | "manual"; timeout?: number; } export type ToolsConfig = Record<string, ToolConfig>;
