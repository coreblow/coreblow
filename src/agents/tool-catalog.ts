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
  {
    id: "multi_patch",
    label: "multi_patch",
    description: "Atomic multi-hunk file replacement",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "file_stat",
    label: "file_stat",
    description: "Inspect file metadata and hash",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "file_tree",
    label: "file_tree",
    description: "ASCII directory tree visualization",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "archive_ops",
    label: "archive_ops",
    description: "Archive operations (tar/zip list, create, extract)",
    sectionId: "fs",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sandbox_backends",
    label: "sandbox_backends",
    description: "List and probe 8 execution backends",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "process_kill",
    label: "process_kill",
    description: "Terminate process by PID",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "env_inspect",
    label: "env_inspect",
    description: "Inspect redacted environment and toolchain versions",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "port_wait",
    label: "port_wait",
    description: "Wait for TCP port readiness",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "ast_symbols",
    label: "ast_symbols",
    description: "Extract functions, classes, and exported symbols",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "code_outline",
    label: "code_outline",
    description: "Structural code outline with line numbers",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "dependency_audit",
    label: "dependency_audit",
    description: "Inspect package.json dependencies and scripts",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "deadcode_scan",
    label: "deadcode_scan",
    description: "Scan for unused exports or unreferenced files",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "test_runner",
    label: "test_runner",
    description: "Targeted test runner (vitest, pytest, cargo)",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "coverage_inspect",
    label: "coverage_inspect",
    description: "Inspect test coverage summary reports",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "git_blame",
    label: "git_blame",
    description: "Line-by-line git blame metadata",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "git_log_search",
    label: "git_log_search",
    description: "Search git commit log by message or diff",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "git_stash_inspect",
    label: "git_stash_inspect",
    description: "Inspect git stash entries without mutating tree",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "git_worktree_list",
    label: "git_worktree_list",
    description: "List active git worktrees and branches",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "http_request",
    label: "http_request",
    description: "Structured REST/GraphQL HTTP client",
    sectionId: "web",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "url_metadata",
    label: "url_metadata",
    description: "Extract OpenGraph, title, and metadata",
    sectionId: "web",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "rss_feed_read",
    label: "rss_feed_read",
    description: "Fetch and parse RSS/Atom XML feeds",
    sectionId: "web",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "memory_layers",
    label: "memory_layers",
    description: "Inspect Cory memory layers and items",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "memory_forget",
    label: "memory_forget",
    description: "Prune or delete obsolete Cory memories",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "wiki_compile",
    label: "wiki_compile",
    description: "Compile or inspect Cory knowledge wiki pages",
    sectionId: "memory",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "session_export",
    label: "session_export",
    description: "Export conversation transcript to Markdown or JSON",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "session_compact",
    label: "session_compact",
    description: "Summarize and compact conversation session",
    sectionId: "sessions",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "war_room_board",
    label: "war_room_board",
    description: "Inspect and move Kanban cards on War Room board",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "skill_create",
    label: "skill_create",
    description: "Synthesize and save a new cognitive skill",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "skill_inspect",
    label: "skill_inspect",
    description: "Read full instructions of an installed skill",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "decision_route",
    label: "decision_route",
    description: "Query Decision Router for model tier recommendation",
    sectionId: "agents",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "cron_run_now",
    label: "cron_run_now",
    description: "Trigger immediate test execution of a cron job",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "workflow_pipeline",
    label: "workflow_pipeline",
    description: "Inspect multi-step DAG workflow pipelines",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "webhook_inspect",
    label: "webhook_inspect",
    description: "Inspect configured inbound webhook routes",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "json_query",
    label: "json_query",
    description: "Query JSON using dot-path expressions",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "csv_inspect",
    label: "csv_inspect",
    description: "Inspect CSV/TSV headers, row counts, and samples",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "sqlite_query",
    label: "sqlite_query",
    description: "Execute read-only SQL queries on SQLite databases",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "hash_encode",
    label: "hash_encode",
    description: "Compute hashes, base64 encode/decode, and UUIDs",
    sectionId: "automation",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "diff_compare",
    label: "diff_compare",
    description: "Generate unified diff between files or strings",
    sectionId: "runtime",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "image_inspect",
    label: "image_inspect",
    description: "Inspect image format and pixel dimensions",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "audio_transcribe",
    label: "audio_transcribe",
    description: "Transcribe audio files to text via Whisper",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "diagram_render",
    label: "diagram_render",
    description: "Format and validate Mermaid/DOT diagrams",
    sectionId: "media",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "security_scan",
    label: "security_scan",
    description: "Scan workspace for leaked secrets and private keys",
    sectionId: "nodes",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "trust_zone_inspect",
    label: "trust_zone_inspect",
    description: "Inspect active TrustZone policy and governance",
    sectionId: "nodes",
    profiles: ["coding"],
    includeInCoreBlowGroup: true,
  },
  {
    id: "toolset_discover",
    label: "toolset_discover",
    description: "List 12 domain toolsets and 75 native tools",
    sectionId: "nodes",
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
