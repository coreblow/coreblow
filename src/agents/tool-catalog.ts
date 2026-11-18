export type ToolProfileId = "minimal" | "coding" | "messaging" | "full";

type ToolProfilePolicy = {
  allow?: string[];
  deny?: string[];
};

export type CoreToolSection = {
  id: string;
  label: string;
  tools: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

type CoreToolDefinition = {
  id: string;
  label: string;
  description: string;
  sectionId: string;
  profiles: ToolProfileId[];
  includeInCoreBlowGroup?: boolean;
};

const CORE_TOOL_SECTION_ORDER: Array<{ id: string; label: string }> = [
  { id: "fs", label: "Files" },
  { id: "runtime", label: "Runtime" },
  { id: "web", label: "Web" },
  { id: "memory", label: "Memory" },
  { id: "sessions", label: "Sessions" },
  { id: "ui", label: "UI" },
  { id: "messaging", label: "Messaging" },
  { id: "automation", label: "Automation" },
  { id: "nodes", label: "Nodes" },
  { id: "agents", label: "Agents" },
  { id: "media", label: "Media" },
];

const CORE_TOOL_DEFINITIONS: CoreToolDefinition[] = [
  {
    id: "read",
    label: "read",
    description: "Read file contents",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "write",
    label: "write",
    description: "Create or overwrite files",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "edit",
    label: "edit",
    description: "Make precise edits",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "apply_patch",
    label: "apply_patch",
    description: "Patch files",
    sectionId: "fs",
    profiles: ["coding"],
  },
  {
    id: "exec",
    label: "exec",
    description: "Run shell commands",
    sectionId: "runtime",
    profiles: ["coding"],
  },
  {
    id: "process",
    label: "process",
    description: "Manage background processes",
    sectionId: "runtime",
    profiles: ["coding"],
  },
  {
    id: "web_search",
    label: "web_search",
    description: "Search the web",
    sectionId: "web",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "web_fetch",
    label: "web_fetch",
    description: "Fetch web content",
    sectionId: "web",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "memory_search",
    label: "memory_search",
    description: "Semantic search",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "memory_get",
    label: "memory_get",
    description: "Read memory files",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sessions_list",
    label: "sessions_list",
    description: "List sessions",
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sessions_history",
    label: "sessions_history",
    description: "Session history",
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sessions_send",
    label: "sessions_send",
    description: "Send to session",
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sessions_spawn",
    label: "sessions_spawn",
    description: "Spawn sub-agent",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sessions_yield",
    label: "sessions_yield",
    description: "End turn to receive sub-agent results",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "subagents",
    label: "subagents",
    description: "Manage sub-agents",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "session_status",
    label: "session_status",
    description: "Session status",
    sectionId: "sessions",
    profiles: ["minimal", "coding", "messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "browser",
    label: "browser",
    description: "Control web browser",
    sectionId: "ui",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  {
    id: "canvas",
    label: "canvas",
    description: "Control canvases",
    sectionId: "ui",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  {
    id: "message",
    label: "message",
    description: "Send messages",
    sectionId: "messaging",
    profiles: ["messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "cron",
    label: "cron",
    description: "Schedule tasks",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "gateway",
    label: "gateway",
    description: "Gateway control",
    sectionId: "automation",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  {
    id: "nodes",
    label: "nodes",
    description: "Nodes + devices",
    sectionId: "nodes",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  {
    id: "agents_list",
    label: "agents_list",
    description: "List agents",
    sectionId: "agents",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  {
    id: "image",
    label: "image",
    description: "Image understanding",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "image_generate",
    label: "image_generate",
    description: "Image generation",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "tts",
    label: "tts",
    description: "Text-to-speech conversion",
    sectionId: "media",
    profiles: [],
    includeInCoreBlowGroup: true,
  },
  // CoreBlow 30-Native ReAct Tools
  {
    id: "terminal",
    label: "terminal",
    description: "Execute shell commands with profile guards",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "read_file",
    label: "read_file",
    description: "Read file contents with line limits",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "write_file",
    label: "write_file",
    description: "Write or overwrite file contents",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "patch",
    label: "patch",
    description: "Apply exact text replacement patch to a file",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "search_files",
    label: "search_files",
    description: "Search file contents by regex or text",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "list_dir",
    label: "list_dir",
    description: "List directory contents recursively",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "memory_store",
    label: "memory_store",
    description: "Store durable insight into memory layers",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "skill_search",
    label: "skill_search",
    description: "Search learned skills in CoreHub",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "delegate_subagent",
    label: "delegate_subagent",
    description: "Delegate sub-task to War Room specialist",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "git_inspect",
    label: "git_inspect",
    description: "Inspect git status, diff, log, and branches",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "process_inspect",
    label: "process_inspect",
    description: "Inspect listening ports and active processes",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "cron_list",
    label: "cron_list",
    description: "List scheduled automations in cron store",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "calculator",
    label: "calculator",
    description: "Deterministic math evaluation",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "session_search",
    label: "session_search",
    description: "Search across persisted conversations",
    sectionId: "sessions",
    profiles: ["coding", "messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "cron_schedule",
    label: "cron_schedule",
    description: "Manage scheduled cron tasks",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "browser_action",
    label: "browser_action",
    description: "Navigate and inspect web pages",
    sectionId: "ui",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "rag_query",
    label: "rag_query",
    description: "Query or index documents in RAG pipeline",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "pr_workflow",
    label: "pr_workflow",
    description: "Create or inspect Pull Request drafts",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "lsp_diagnostics",
    label: "lsp_diagnostics",
    description: "Run fast syntax and type diagnostics",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "execute_code",
    label: "execute_code",
    description: "Programmatic tool calling snippet execution",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "message_channel",
    label: "message_channel",
    description: "Send outbound notifications to messaging channels",
    sectionId: "messaging",
    profiles: ["messaging"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "nodes_status",
    label: "nodes_status",
    description: "Inspect local and paired mesh nodes",
    sectionId: "nodes",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "tts_speak",
    label: "tts_speak",
    description: "Synthesize speech audio or list voices",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "pdf_extract",
    label: "pdf_extract",
    description: "Extract text and metadata from PDF files",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
];

const CORE_TOOL_BY_ID = new Map<string, CoreToolDefinition>(
  CORE_TOOL_DEFINITIONS.map((tool) => [tool.id, tool]),
);

function listCoreToolIdsForProfile(profile: ToolProfileId): string[] {
  return CORE_TOOL_DEFINITIONS.filter((tool) => tool.profiles.includes(profile)).map(
    (tool) => tool.id,
  );
}

const CORE_TOOL_PROFILES: Record<ToolProfileId, ToolProfilePolicy> = {
  minimal: {
    allow: listCoreToolIdsForProfile("minimal"),
  },
  coding: {
    allow: listCoreToolIdsForProfile("coding"),
  },
  messaging: {
    allow: listCoreToolIdsForProfile("messaging"),
  },
  full: {},
};

function buildCoreToolGroupMap() {
  const sectionToolMap = new Map<string, string[]>();
  for (const tool of CORE_TOOL_DEFINITIONS) {
    const groupId = `group:${tool.sectionId}`;
    const list = sectionToolMap.get(groupId) ?? [];
    list.push(tool.id);
    sectionToolMap.set(groupId, list);
  }
  const coreblowTools = CORE_TOOL_DEFINITIONS.filter((tool) => tool.includeInCoreBlowGroup).map(
    (tool) => tool.id,
  );
  return {
    "group:coreblow": coreblowTools,
    ...Object.fromEntries(sectionToolMap.entries()),
  };
}

export const CORE_TOOL_GROUPS = buildCoreToolGroupMap();

export const PROFILE_OPTIONS = [
  { id: "minimal", label: "Minimal" },
  { id: "coding", label: "Coding" },
  { id: "messaging", label: "Messaging" },
  { id: "full", label: "Full" },
] as const;

export function resolveCoreToolProfilePolicy(profile?: string): ToolProfilePolicy | undefined {
  if (!profile) {
    return undefined;
  }
  const resolved = CORE_TOOL_PROFILES[profile as ToolProfileId];
  if (!resolved) {
    return undefined;
  }
  if (!resolved.allow && !resolved.deny) {
    return undefined;
  }
  return {
    allow: resolved.allow ? [...resolved.allow] : undefined,
    deny: resolved.deny ? [...resolved.deny] : undefined,
  };
}

export function listCoreToolSections(): CoreToolSection[] {
  return CORE_TOOL_SECTION_ORDER.map((section) => ({
    id: section.id,
    label: section.label,
    tools: CORE_TOOL_DEFINITIONS.filter((tool) => tool.sectionId === section.id).map((tool) => ({
      id: tool.id,
      label: tool.label,
      description: tool.description,
    })),
  })).filter((section) => section.tools.length > 0);
}

export function resolveCoreToolProfiles(toolId: string): ToolProfileId[] {
  const tool = CORE_TOOL_BY_ID.get(toolId);
  if (!tool) {
    return [];
  }
  return [...tool.profiles];
}

export function isKnownCoreToolId(toolId: string): boolean {
  return CORE_TOOL_BY_ID.has(toolId);
}

// Stub class — used by agent-engine.ts OOP facade
export type ToolDefinition = { name: string; description: string; category: string; inputSchema: unknown; enabled: boolean };
export class ToolCatalog {
  private tools = new Map<string, ToolDefinition>();
  register(def: ToolDefinition): void { this.tools.set(def.name, def); }
  list(): ToolDefinition[] { return [...this.tools.values()]; }
  get(name: string): ToolDefinition | undefined { return this.tools.get(name); }
}

/**
 * Lazy getter for unified OpenAI tool definitions to preserve fast CLI startup import budget.
 */
export async function getUnifiedCoreBlowToolDefinitions() {
  const { getUnifiedCoreBlowToolDefinitions: getDefs } = await import("./coreblow-react-engine.js");
  return getDefs();
}
