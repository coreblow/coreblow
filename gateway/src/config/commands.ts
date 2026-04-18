/** CoreBlow — Config Commands */
export interface ConfigCommand { name: string; description: string; category: "read" | "write" | "admin"; }
export const CONFIG_COMMANDS: ConfigCommand[] = [
  { name: "get", description: "Get a config value", category: "read" },
  { name: "set", description: "Set a config value", category: "write" },
  { name: "list", description: "List all config values", category: "read" },
  { name: "reset", description: "Reset config to defaults", category: "admin" },
  { name: "validate", description: "Validate current config", category: "read" },
  { name: "export", description: "Export config as JSON", category: "read" },
  { name: "import", description: "Import config from JSON", category: "write" },
];
