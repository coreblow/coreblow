import { commandDescription } from "./command-description.js";

export type SubCliDescriptor = {
  name: string;
  description: string;
  hasSubcommands: boolean;
};

export const SUB_CLI_DESCRIPTORS = [
  {
    name: "acp",
    description: commandDescription("acp", "Agent Control Protocol tools"),
    hasSubcommands: true,
  },
  {
    name: "gateway",
    description: commandDescription("gateway", "Run, inspect, and query the WebSocket Gateway"),
    hasSubcommands: true,
  },
  {
    name: "daemon",
    description: commandDescription("daemon", "Gateway service (legacy alias)"),
    hasSubcommands: true,
  },
  {
    name: "logs",
    description: commandDescription("logs", "Tail gateway file logs via RPC"),
    hasSubcommands: false,
  },
  {
    name: "system",
    description: commandDescription("system", "System events, heartbeat, and presence"),
    hasSubcommands: true,
  },
  {
    name: "models",
    description: commandDescription("models", "Discover, scan, and configure models"),
    hasSubcommands: true,
  },
  {
    name: "approvals",
    description: commandDescription("approvals", "Manage exec approvals (gateway or node host)"),
    hasSubcommands: true,
  },
  {
    name: "nodes",
    description: commandDescription("nodes", "Manage gateway-owned node pairing and node commands"),
    hasSubcommands: true,
  },
  {
    name: "devices",
    description: commandDescription("devices", "Device pairing + token management"),
    hasSubcommands: true,
  },
  {
    name: "node",
    description: commandDescription("node", "Run and manage the headless node host service"),
    hasSubcommands: true,
  },
  {
    name: "sandbox",
    description: commandDescription("sandbox", "Manage sandbox containers for agent isolation"),
    hasSubcommands: true,
  },
  {
    name: "tui",
    description: commandDescription("tui", "Open a terminal UI connected to the Gateway"),
    hasSubcommands: false,
  },
  {
    name: "cron",
    description: commandDescription("cron", "Manage cron jobs via the Gateway scheduler"),
    hasSubcommands: true,
  },
  {
    name: "dns",
    description: commandDescription("dns", "DNS helpers for wide-area discovery (Tailscale + CoreDNS)"),
    hasSubcommands: true,
  },
  {
    name: "docs",
    description: commandDescription("docs", "Search the live CoreBlow docs"),
    hasSubcommands: false,
  },
  {
    name: "hooks",
    description: commandDescription("hooks", "Manage internal agent hooks"),
    hasSubcommands: true,
  },
  {
    name: "webhooks",
    description: commandDescription("webhooks", "Webhook helpers and integrations"),
    hasSubcommands: true,
  },
  {
    name: "qr",
    description: commandDescription("qr", "Generate iOS pairing QR/setup code"),
    hasSubcommands: false,
  },
  {
    name: "corebot",
    description: commandDescription("corebot", "Legacy corebot command aliases"),
    hasSubcommands: true,
  },
  {
    name: "pairing",
    description: commandDescription("pairing", "Secure DM pairing (approve inbound requests)"),
    hasSubcommands: true,
  },
  {
    name: "plugins",
    description: commandDescription("plugins", "Manage CoreBlow plugins and extensions"),
    hasSubcommands: true,
  },
  {
    name: "channels",
    description: commandDescription(
      "channels",
      "Manage connected chat channels (Telegram, Discord, etc.)",
    ),
    hasSubcommands: true,
  },
  {
    name: "directory",
    description: commandDescription(
      "directory",
      "Lookup contact and group IDs (self, peers, groups) for supported chat channels",
    ),
    hasSubcommands: true,
  },
  {
    name: "security",
    description: commandDescription("security", "Security tools and local config audits"),
    hasSubcommands: true,
  },
  {
    name: "secrets",
    description: commandDescription("secrets", "Secrets runtime reload controls"),
    hasSubcommands: true,
  },
  {
    name: "skills",
    description: commandDescription("skills", "List and inspect available skills"),
    hasSubcommands: true,
  },
  {
    name: "update",
    description: commandDescription("update", "Update CoreBlow and inspect update channel status"),
    hasSubcommands: true,
  },
  {
    name: "completion",
    description: commandDescription("completion", "Generate shell completion script"),
    hasSubcommands: false,
  },
] as const satisfies ReadonlyArray<SubCliDescriptor>;

export function getSubCliEntries(): ReadonlyArray<SubCliDescriptor> {
  return SUB_CLI_DESCRIPTORS;
}

export function getSubCliCommandsWithSubcommands(): string[] {
  return SUB_CLI_DESCRIPTORS.filter((entry) => entry.hasSubcommands).map((entry) => entry.name);
}
