export type PermissionMode = "Full access" | "Workspace" | "Guarded" | "Read-only";

export type ModelTier = "Fast" | "Balanced" | "High Reasoning";

export interface ToolExecutionStep {
  stepIndex: number;
  tool: string;
  description?: string;
  input?: unknown;
  output?: unknown;
  status: "idle" | "running" | "done" | "warning" | "error";
  durationMs?: number;
  phase?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolSteps?: ToolExecutionStep[];
  attachedFiles?: string[];
  error?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  executionProfile: PermissionMode;
  model: string;
  cwd?: string;
  pinned?: boolean;
}

export interface DesktopAgent {
  id: string;
  name: string;
  tagline: string;
  systemPrompt?: string;
  accentColor: string;
  muted?: boolean;
  updatedAt: number;
  messages: ChatMessage[];
  pinned?: boolean;
  hidden?: boolean;
  sectionId?: string | null;
  autoOpenScreen?: boolean;
  defaultModel?: string;
  groupIds?: string[];
  lastSessionId?: string | null;
}

export interface AgentSection {
  id: string;
  name: string;
  collapsed?: boolean;
  createdAt: number;
}

export interface AgentGroup {
  id: string;
  name: string;
  agentIds: string[];
  messages: ChatMessage[];
  updatedAt: number;
}

export interface CoryMemoryLayer {
  layer: string;
  count: number;
  summary: string;
  updatedAt?: string;
}

export interface CoryMemoryItem {
  id: string;
  layer: string;
  title: string;
  content: string;
  score?: number;
  tags?: string[];
  createdAt?: string;
}

export interface CoreHubSkill {
  id: string;
  name: string;
  description: string;
  category?: string;
  author?: string;
  version?: string;
  installed?: boolean;
}

export interface GitGateStatus {
  check: "pending" | "pass" | "fail";
  test: "pending" | "pass" | "fail";
  build: "pending" | "pass" | "fail";
  format: "pending" | "pass" | "fail";
  types: "pending" | "pass" | "fail";
}

export interface ActiveProjectState {
  path: string;
  name: string;
  branch: string;
  isGit: boolean;
  uncommittedFiles: number;
}

export type WarRoomRole = "lead" | "coder" | "researcher" | "auditor" | "verifier";

export interface WarRoomMember {
  agentId: string;
  name: string;
  role: WarRoomRole;
  routeTier: string;
  liveState: "idle" | "thinking" | "executing_tool" | "awaiting_approval" | "completed";
}

export interface KanbanCard {
  taskId: string;
  title: string;
  column: "backlog" | "in_progress" | "review" | "done";
  assigneeAgentId: string;
  requiredSkillIds: string[];
}

export interface ChildApprovalRequest {
  approvalId: string;
  parentSessionId: string;
  childSessionId: string;
  agentId: string;
  toolName: string;
  status: "pending" | "approved" | "denied";
}

export interface WarRoomChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: WarRoomRole | "user" | "system";
  content: string;
  mentions: WarRoomRole[];
  handoffDepth: number;
  createdAt: number;
}

export interface AgentScreenFrame {
  id: string;
  roomId: string;
  agentId: string;
  role: WarRoomRole | "system" | "user";
  kind: "thinking" | "tool_start" | "tool_output" | "tool_done" | "kanban_move" | "approval" | "chat_message";
  summary: string;
  detail?: string;
  timestamp: number;
}

export interface WarRoomState {
  roomId: string;
  title: string;
  purpose: string;
  leadAgentId: string;
  members: WarRoomMember[];
  kanbanBoard: KanbanCard[];
  pendingApprovals: ChildApprovalRequest[];
  messages: WarRoomChatMessage[];
  screenFeed: AgentScreenFrame[];
}

export interface DialecticTrait {
  id: string;
  dimension: string;
  key: string;
  value: string;
  confidence: number;
  updatedAt: number;
  supersededBy?: string;
}

export interface MemoryProposal {
  id: string;
  content: string;
  targetLayer: string;
  dimension?: string;
  source: string;
  createdAt: number;
  status: "pending" | "approved" | "dismissed";
  resolvedAt?: number;
}

export interface CoryProfilePayload {
  ok: boolean;
  profile: {
    updatedAt: number;
    traits: DialecticTrait[];
    allSignals?: DialecticTrait[];
  };
  itemsByLayer: {
    identity: CoryMemoryItem[];
    durable: CoryMemoryItem[];
    constraint: CoryMemoryItem[];
    episodic: CoryMemoryItem[];
  };
  pendingProposals: MemoryProposal[];
  counts: Record<string, number>;
}

export interface MaskedPooledCredential {
  id: string;
  providerId: string;
  label: string;
  apiKey: string;
  priority: number;
  enabled: boolean;
  cooldownUntilMs?: number;
  errorCount: number;
  lastUsedAtMs?: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAtMs: number;
}

export interface ProviderUsageTelemetry {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  failovers: number;
}

export interface CredentialPoolPayload {
  ok: boolean;
  fallbackChain: string[];
  pools: Record<string, MaskedPooledCredential[]>;
  telemetry: {
    daily: Record<string, ProviderUsageTelemetry>;
    monthly: Record<string, ProviderUsageTelemetry>;
    lifetime: ProviderUsageTelemetry;
    byProvider: Record<string, ProviderUsageTelemetry>;
  };
}

export type RemoteNodeKind = "local" | "tailscale" | "vps" | "docker";

export interface RemoteNodeConfig {
  id: string;
  name: string;
  url: string;
  kind: RemoteNodeKind;
  bearerToken?: string;
  enabled: boolean;
  latencyMs?: number;
  healthy?: boolean;
  lastCheckedAtMs?: number;
}

export interface VoiceTranscribeResponse {
  ok: boolean;
  text?: string;
  engine?: string;
  durationMs?: number;
  fallbackHint?: string;
  error?: string;
}

export interface VoiceSpeakResponse {
  ok: boolean;
  mode?: string;
  text?: string;
  voice?: string;
  rate?: number;
  audioBase64?: string;
  format?: string;
  engine?: string;
  error?: string;
}

export type CuratedMemoryFileId = "user" | "memory" | "constraints";

export interface CuratedMemoryFile {
  id: CuratedMemoryFileId;
  filename: string;
  path: string;
  content: string;
  charCount: number;
  charLimit: number;
  updatedAt: string;
}
