/** CoreBlow — Core Command Descriptors */
export const CORE_COMMANDS = [
  { name: "talk", description: "Start interactive conversation", category: "core" },
  { name: "config", description: "Manage configuration", category: "admin" },
  { name: "gateway", description: "Manage gateway server", category: "infra" },
  { name: "plugins", description: "Manage plugins", category: "admin" },
  { name: "models", description: "List available models", category: "info" },
  { name: "update", description: "Check for updates", category: "admin" },
  { name: "status", description: "Show system status", category: "info" },
] as const;
