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
