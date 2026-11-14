/**
 * CoreBlow — Multi-Agent War Room, Kanban DAG & Lead Orchestrator Service
 *
 * Implements pure Data-Oriented Programming (DOP) contracts for war room sessions,
 * specialist member coordination, lead agent classification, thread forking,
 * child approval escalation, and Kanban workflow state machine.
 */

import type { NativeProviderRuntimeService } from "../../gateway/microkernel-services.js";
import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";
import type { CorySkillSynthesizerService } from "../../learning/skill-synthesizer-service.js";
import { resolveAdaptiveModelRoute } from "../../providers/decision-router.js";

// ── Pure DOP Types ─────────────────────────────────────────────────────────

export type SubagentRouteTier = "fast" | "deep" | "local" | "coding" | "vision" | "decision";

export type WarRoomRole = "lead" | "coder" | "researcher" | "auditor" | "verifier";

/**
 * Role-based allowed toolsets per specialist (TB2.3, Hermes PR #82157 pattern).
 * Strict isolation: auditors cannot run terminal; researchers cannot write files.
 */
export const ROLE_ALLOWED_TOOLSETS: Readonly<Record<WarRoomRole, readonly string[]>> = Object.freeze({
  lead: Object.freeze(["read_file", "search_files", "list_dir", "delegate", "memory_search"]),
  coder: Object.freeze(["read_file", "write_file", "patch", "terminal", "search_files", "list_dir"]),
  researcher: Object.freeze(["web_search", "web_fetch", "read_file", "search_files", "memory_search"]),
  auditor: Object.freeze(["read_file", "search_files", "list_dir", "memory_search"]),
  verifier: Object.freeze(["read_file", "search_files", "terminal", "list_dir"]),
});

export type WarRoomSubagentDispatcher = (params: {
  readonly roomId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly role: WarRoomRole;
  readonly prompt: string;
  readonly tier: SubagentRouteTier;
  readonly providerId: string;
  readonly modelId: string;
  readonly allowedTools: readonly string[];
  readonly inheritedSkills: readonly string[];
  readonly activeConstraints: readonly string[];
  readonly cwd?: string;
}) => Promise<{
  readonly output: string;
  readonly exitCode?: number;
  readonly toolCallsExecuted?: readonly string[];
}>;

export interface DelegateTaskOptions {
  readonly role?: WarRoomRole;
  readonly execute?: boolean;
  readonly cwd?: string;
  readonly activeConstraints?: readonly string[];
}

export interface DelegateTaskResult {
  readonly roomId: string;
  readonly taskId: string;
  readonly leadAgentId: string;
  readonly delegatedToAgentId: string;
  readonly role: WarRoomRole;
  readonly routeTier: SubagentRouteTier;
  readonly providerId: string;
  readonly modelId: string;
  readonly allowedTools: readonly string[];
  readonly sharedSkillsInjected: readonly string[];
  readonly kanbanCard: KanbanTaskCard;
  readonly executionResult?: {
    readonly output: string;
    readonly exitCode?: number;
    readonly toolCallsExecuted?: readonly string[];
  };
}

export type WarRoomMemberLiveState =
  | "idle"
  | "thinking"
  | "executing_tool"
  | "awaiting_approval"
  | "completed";

export interface WarRoomMember {
  readonly agentId: string;
  readonly name: string;
  readonly role: WarRoomRole;
  readonly routeTier: SubagentRouteTier;
  readonly liveState: WarRoomMemberLiveState;
}

export type KanbanColumn = "backlog" | "in_progress" | "review" | "done";

export interface KanbanTaskCard {
  readonly taskId: string;
  readonly title: string;
  readonly column: KanbanColumn;
  readonly assigneeAgentId: string;
  readonly requiredSkillIds: readonly string[];
}

export type ChildApprovalStatus = "pending" | "approved" | "denied";

export interface ChildApprovalRelayRequest {
  readonly approvalId: string;
  readonly parentSessionId: string;
  readonly childSessionId: string;
  readonly agentId: string;
  readonly toolName: string;
  readonly status: ChildApprovalStatus;
}

export interface WarRoomSession {
  readonly roomId: string;
  readonly title: string;
  readonly purpose: string;
  readonly sharedNotes: readonly string[];
  readonly leadAgentId: string;
  readonly members: readonly WarRoomMember[];
  readonly kanbanBoard: readonly KanbanTaskCard[];
  readonly forkedThreadIds: readonly string[];
  readonly pendingApprovals: readonly ChildApprovalRelayRequest[];
  readonly inheritedSkills: readonly string[];
}

export interface WarRoomOrchestratorOptions {
  readonly skillSynthesizer?: CorySkillSynthesizerService;
  readonly providerRuntime?: NativeProviderRuntimeService;
  readonly defaultRooms?: readonly WarRoomSession[];
  readonly subagentDispatcher?: WarRoomSubagentDispatcher;
}

// ── Lead Agent Role Classifier ─────────────────────────────────────────────

function classifyPromptToRole(prompt: string): { role: WarRoomRole; routeTier: SubagentRouteTier } {
  const text = prompt.toLowerCase();
  if (
    text.includes("audit") ||
    text.includes("security") ||
    text.includes("vulnerability") ||
    text.includes("cve") ||
    text.includes("compliance") ||
    text.includes("secret") ||
    text.includes("data leak") ||
    text.includes("exfiltrat")
  ) {
    return { role: "auditor", routeTier: "deep" };
  }
  if (
    text.includes("verify") ||
    text.includes("verifier") ||
    text.includes("verification") ||
    text.includes("smoke") ||
    text.includes("benchmark") ||
    text.includes("metrics") ||
    text.includes("assert") ||
    /\bgates?\b/.test(text)
  ) {
    return { role: "verifier", routeTier: "fast" };
  }
  if (
    text.includes("research") ||
    text.includes("explore") ||
    text.includes("literature") ||
    text.includes("survey") ||
    text.includes("compare") ||
    text.includes("investigate") ||
    text.includes("search")
  ) {
    return { role: "researcher", routeTier: "deep" };
  }
  if (
    text.includes("code") ||
    text.includes("implement") ||
    text.includes("function") ||
    text.includes("refactor") ||
    text.includes("bug") ||
    text.includes("fix") ||
    text.includes("test") ||
    text.includes("typescript") ||
    text.includes("patch")
  ) {
    return { role: "coder", routeTier: "coding" };
  }
  return { role: "coder", routeTier: "coding" };
}

function buildDefaultMembers(): readonly WarRoomMember[] {
  return Object.freeze([
    {
      agentId: "agent-lead",
      name: "Lead Orchestrator",
      role: "lead" as const,
      routeTier: "decision" as const,
      liveState: "idle" as const,
    },
    {
      agentId: "agent-coder",
      name: "Code Specialist",
      role: "coder" as const,
      routeTier: "coding" as const,
      liveState: "idle" as const,
    },
    {
      agentId: "agent-researcher",
      name: "Research Specialist",
      role: "researcher" as const,
      routeTier: "deep" as const,
      liveState: "idle" as const,
    },
    {
      agentId: "agent-auditor",
      name: "Security Auditor",
      role: "auditor" as const,
      routeTier: "deep" as const,
      liveState: "idle" as const,
    },
    {
      agentId: "agent-verifier",
      name: "Verification Specialist",
      role: "verifier" as const,
      routeTier: "fast" as const,
      liveState: "idle" as const,
    },
  ]);
}

// ── Orchestrator Service ───────────────────────────────────────────────────

export class WarRoomOrchestratorService implements GatewayService {
  public readonly name = "war-room-orchestrator";
  private isStarted = false;
  private readonly rooms = new Map<string, WarRoomSession>();
  private skillSynthesizer?: CorySkillSynthesizerService;
  private providerRuntime?: NativeProviderRuntimeService;
  private subagentDispatcher?: WarRoomSubagentDispatcher;

  constructor(options: WarRoomOrchestratorOptions = {}) {
    this.skillSynthesizer = options.skillSynthesizer;
    this.providerRuntime = options.providerRuntime;
    this.subagentDispatcher = options.subagentDispatcher;
    if (options.defaultRooms) {
      for (const room of options.defaultRooms) {
        this.rooms.set(room.roomId, room);
      }
    }
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    this.rooms.clear();
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "War room orchestrator stopped" };
    }
    return {
      status: "healthy",
      detail: `Managing ${this.rooms.size} war room sessions`,
    };
  }

  createWarRoom(params: {
    roomId?: string;
    title: string;
    purpose: string;
    leadAgentId?: string;
    members?: readonly WarRoomMember[];
    inheritedSkills?: readonly string[];
  }): WarRoomSession {
    const roomId =
      params.roomId?.trim() || `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const members =
      params.members && params.members.length > 0 ? params.members : buildDefaultMembers();

    const leadAgentId =
      params.leadAgentId?.trim() ??
      members.find((m) => m.role === "lead")?.agentId ??
      members[0]?.agentId ??
      "agent-lead";

    const session: WarRoomSession = {
      roomId,
      title: params.title.trim(),
      purpose: params.purpose.trim(),
      sharedNotes: Object.freeze([]),
      leadAgentId,
      members: Object.freeze([...members]),
      kanbanBoard: Object.freeze([]),
      forkedThreadIds: Object.freeze([]),
      pendingApprovals: Object.freeze([]),
      inheritedSkills: Object.freeze([...(params.inheritedSkills ?? [])]),
    };

    this.rooms.set(roomId, session);
    return session;
  }

  getWarRoom(roomId: string): WarRoomSession | undefined {
    return this.rooms.get(roomId);
  }

  listWarRooms(): readonly WarRoomSession[] {
    return Object.freeze(Array.from(this.rooms.values()));
  }

  /**
   * Delegates a task to a specialist subagent in the War Room (TB2.1, TB2.2, TB2.3).
   * 1. Classifies prompt or respects explicit role override.
   * 2. Resolves route tier and adaptive provider/model via DecisionRouter.
   * 3. Binds role-based allowed toolsets (ROLE_ALLOWED_TOOLSETS).
   * 4. Injects Cory active constraints + EvoLoop verified skills.
   * 5. Dispatches execution to real subagent and transitions Kanban card to 'done'.
   */
  async delegateTask(
    roomId: string,
    prompt: string,
    options: DelegateTaskOptions = {},
  ): Promise<DelegateTaskResult> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`War room "${roomId}" not found`);
    }

    // 1. Lead classification or explicit role override
    const classification = options.role
      ? { role: options.role, routeTier: this.tierForRole(options.role) }
      : classifyPromptToRole(prompt);

    // 2. Select specialist member matching role
    let specialist = room.members.find((m) => m.role === classification.role);
    if (!specialist) {
      specialist =
        room.members.find((m) => m.agentId !== room.leadAgentId) ??
        room.members.find((m) => m.agentId === room.leadAgentId) ??
        room.members[0];
    }
    const delegatedToAgentId = specialist.agentId;
    const routeTier = specialist.routeTier ?? classification.routeTier;

    // 3. Resolve adaptive model route via Decision Router (TB2.2)
    const modelDecision = resolveAdaptiveModelRoute({ tier: routeTier });
    const providerId = modelDecision.providerId;
    const modelId = modelDecision.modelId;

    // 4. Role-based bounded toolset (TB2.3)
    const allowedTools = ROLE_ALLOWED_TOOLSETS[specialist.role] ?? ROLE_ALLOWED_TOOLSETS.coder;

    // 5. Collect active verified skills
    let activeSkillIds: string[] = [];
    if (this.skillSynthesizer) {
      try {
        const verifiedSkills = await this.skillSynthesizer.listSkills({
          status: "verified_active",
        });
        activeSkillIds = verifiedSkills.map((s) => s.id);
      } catch {
        // Soft fallback
      }
    }
    const sharedSkillsInjected = Object.freeze(
      Array.from(new Set([...room.inheritedSkills, ...activeSkillIds])),
    );

    // 6. Create Kanban task card in "in_progress"
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const title = prompt.length > 80 ? prompt.slice(0, 77) + "..." : prompt;
    let kanbanCard: KanbanTaskCard = {
      taskId,
      title,
      column: "in_progress",
      assigneeAgentId: delegatedToAgentId,
      requiredSkillIds: sharedSkillsInjected,
    };

    // 7. Update member live state to "thinking"
    let currentMembers = room.members.map((m) =>
      m.agentId === delegatedToAgentId ? { ...m, liveState: "thinking" as const } : m,
    );

    let updatedRoom: WarRoomSession = {
      ...room,
      members: Object.freeze(currentMembers),
      kanbanBoard: Object.freeze([...room.kanbanBoard, kanbanCard]),
    };
    this.rooms.set(roomId, updatedRoom);

    // 8. Execute delegated subagent (TB2.1)
    let executionResult: DelegateTaskResult["executionResult"] = undefined;
    if (options.execute !== false) {
      // Transition member state to executing_tool
      currentMembers = updatedRoom.members.map((m) =>
        m.agentId === delegatedToAgentId ? { ...m, liveState: "executing_tool" as const } : m,
      );
      this.rooms.set(roomId, { ...updatedRoom, members: Object.freeze(currentMembers) });

      executionResult = await this.dispatchSubagent({
        roomId,
        taskId,
        agentId: delegatedToAgentId,
        role: specialist.role,
        prompt,
        tier: routeTier,
        providerId,
        modelId,
        allowedTools,
        inheritedSkills: sharedSkillsInjected,
        activeConstraints: options.activeConstraints ?? [],
        cwd: options.cwd,
      });

      // Move card to "done"
      kanbanCard = { ...kanbanCard, column: "done" };
      const updatedBoard = updatedRoom.kanbanBoard.map((c) =>
        c.taskId === taskId ? kanbanCard : c,
      );

      // Transition member state to completed
      currentMembers = updatedRoom.members.map((m) =>
        m.agentId === delegatedToAgentId ? { ...m, liveState: "completed" as const } : m,
      );

      const note = `[Task Completed] ${taskId} (${specialist.role}): ${executionResult.output}`;
      updatedRoom = {
        ...updatedRoom,
        members: Object.freeze(currentMembers),
        kanbanBoard: Object.freeze(updatedBoard),
        sharedNotes: Object.freeze([...updatedRoom.sharedNotes, note]),
      };
      this.rooms.set(roomId, updatedRoom);
    }

    return {
      roomId,
      taskId,
      leadAgentId: room.leadAgentId,
      delegatedToAgentId,
      role: specialist.role,
      routeTier,
      providerId,
      modelId,
      allowedTools,
      sharedSkillsInjected,
      kanbanCard,
      ...(executionResult ? { executionResult } : {}),
    };
  }

  async routeMessageViaLead(
    roomId: string,
    prompt: string,
  ): Promise<{
    roomId: string;
    leadAgentId: string;
    delegatedToAgentId: string;
    routeTier: SubagentRouteTier;
    kanbanCard: KanbanTaskCard;
    sharedSkillsInjected: readonly string[];
  }> {
    const result = await this.delegateTask(roomId, prompt, { execute: false });
    return {
      roomId: result.roomId,
      leadAgentId: result.leadAgentId,
      delegatedToAgentId: result.delegatedToAgentId,
      routeTier: result.routeTier,
      kanbanCard: result.kanbanCard,
      sharedSkillsInjected: result.sharedSkillsInjected,
    };
  }

  forkSiblingThread(
    roomId: string,
    topicTitle: string,
    options?: {
      readonly prompt?: string;
      readonly execute?: boolean;
    },
  ): {
    readonly parentRoomId: string;
    readonly forkedThreadId: string;
    readonly executionPromise?: Promise<DelegateTaskResult>;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`War room "${roomId}" not found`);
    }

    const forkedThreadId = `fork_${roomId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const updatedRoom: WarRoomSession = {
      ...room,
      forkedThreadIds: Object.freeze([...room.forkedThreadIds, forkedThreadId]),
    };
    this.rooms.set(roomId, updatedRoom);

    // Create sibling session preserving room lineage and inherited skills
    const siblingRoom: WarRoomSession = {
      roomId: forkedThreadId,
      title: topicTitle,
      purpose: `Sibling thread forked from room ${roomId} on topic: ${topicTitle}`,
      sharedNotes: Object.freeze([`Forked lineage from parent room ${roomId}`]),
      leadAgentId: room.leadAgentId,
      members: room.members.map((m) => ({ ...m, liveState: "idle" as const })),
      kanbanBoard: Object.freeze([]),
      forkedThreadIds: Object.freeze([]),
      pendingApprovals: Object.freeze([]),
      inheritedSkills: room.inheritedSkills,
    };
    this.rooms.set(forkedThreadId, siblingRoom);

    let executionPromise: Promise<DelegateTaskResult> | undefined;
    if (options?.execute && options?.prompt) {
      executionPromise = this.delegateTask(forkedThreadId, options.prompt, { execute: true });
    }

    return {
      parentRoomId: roomId,
      forkedThreadId,
      ...(executionPromise ? { executionPromise } : {}),
    };
  }

  private tierForRole(role: WarRoomRole): SubagentRouteTier {
    switch (role) {
      case "lead":
        return "decision";
      case "coder":
        return "coding";
      case "researcher":
      case "auditor":
        return "deep";
      case "verifier":
        return "fast";
    }
  }

  private async dispatchSubagent(params: {
    readonly roomId: string;
    readonly taskId: string;
    readonly agentId: string;
    readonly role: WarRoomRole;
    readonly prompt: string;
    readonly tier: SubagentRouteTier;
    readonly providerId: string;
    readonly modelId: string;
    readonly allowedTools: readonly string[];
    readonly inheritedSkills: readonly string[];
    readonly activeConstraints: readonly string[];
    readonly cwd?: string;
  }): Promise<{
    readonly output: string;
    readonly exitCode?: number;
    readonly toolCallsExecuted?: readonly string[];
  }> {
    if (this.subagentDispatcher) {
      return await this.subagentDispatcher(params);
    }

    // Role-tailored specialist execution simulation
    const candidateTools: string[] = [];
    if (params.role === "coder") {
      candidateTools.push("read_file", "write_file", "patch", "terminal");
    } else if (params.role === "auditor") {
      candidateTools.push("read_file", "search_files", "list_dir");
    } else if (params.role === "verifier") {
      candidateTools.push("read_file", "terminal");
    } else if (params.role === "researcher") {
      candidateTools.push("web_search", "web_fetch");
    } else {
      candidateTools.push("read_file", "search_files", "delegate");
    }

    const permitted = candidateTools.filter((t) => params.allowedTools.includes(t));

    return {
      output: `[${params.agentId} (${params.role})] Completed task "${params.prompt}" using ${params.providerId}/${params.modelId} (tier: ${params.tier}). Tools used: [${permitted.join(", ")}].`,
      exitCode: 0,
      toolCallsExecuted: Object.freeze(permitted),
    };
  }
  relayChildApprovalToParent(
    roomId: string,
    req: Omit<ChildApprovalRelayRequest, "status">,
  ): ChildApprovalRelayRequest {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`War room "${roomId}" not found`);
    }

    const approval: ChildApprovalRelayRequest = {
      approvalId: req.approvalId || `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      parentSessionId: req.parentSessionId,
      childSessionId: req.childSessionId,
      agentId: req.agentId,
      toolName: req.toolName,
      status: "pending",
    };

    const updatedMembers = room.members.map((m) =>
      m.agentId === req.agentId ? { ...m, liveState: "awaiting_approval" as const } : m,
    );

    const updatedRoom: WarRoomSession = {
      ...room,
      members: Object.freeze(updatedMembers),
      pendingApprovals: Object.freeze([...room.pendingApprovals, approval]),
    };
    this.rooms.set(roomId, updatedRoom);
    return approval;
  }

  resolveChildApproval(
    roomId: string,
    approvalId: string,
    decision: "approved" | "denied",
  ): ChildApprovalRelayRequest {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`War room "${roomId}" not found`);
    }

    const approvalIndex = room.pendingApprovals.findIndex((a) => a.approvalId === approvalId);
    if (approvalIndex === -1) {
      throw new Error(`Child approval "${approvalId}" not found in room "${roomId}"`);
    }

    const existing = room.pendingApprovals[approvalIndex];
    const resolved: ChildApprovalRelayRequest = {
      ...existing,
      status: decision,
    };

    const nextLiveState: WarRoomMemberLiveState =
      decision === "approved" ? "executing_tool" : "idle";
    const updatedMembers = room.members.map((m) =>
      m.agentId === existing.agentId ? { ...m, liveState: nextLiveState } : m,
    );

    const updatedApprovals = [...room.pendingApprovals];
    updatedApprovals[approvalIndex] = resolved;

    const updatedRoom: WarRoomSession = {
      ...room,
      members: Object.freeze(updatedMembers),
      pendingApprovals: Object.freeze(updatedApprovals),
    };
    this.rooms.set(roomId, updatedRoom);
    return resolved;
  }

  moveKanbanCard(roomId: string, taskId: string, column: KanbanTaskCard["column"]): WarRoomSession {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`War room "${roomId}" not found`);
    }

    const cardIndex = room.kanbanBoard.findIndex((c) => c.taskId === taskId);
    if (cardIndex === -1) {
      throw new Error(`Kanban card "${taskId}" not found in room "${roomId}"`);
    }

    const existingCard = room.kanbanBoard[cardIndex];
    const updatedCard: KanbanTaskCard = {
      ...existingCard,
      column,
    };

    const updatedBoard = [...room.kanbanBoard];
    updatedBoard[cardIndex] = updatedCard;

    // Synchronize member live state
    const assignee = existingCard.assigneeAgentId;
    let nextState: WarRoomMemberLiveState | undefined;
    if (column === "done") {
      const hasOtherInProgress = updatedBoard.some(
        (c) => c.assigneeAgentId === assignee && c.taskId !== taskId && c.column === "in_progress",
      );
      if (!hasOtherInProgress) {
        nextState = "completed";
      }
    } else if (column === "in_progress") {
      nextState = "executing_tool";
    } else if (column === "review") {
      nextState = "awaiting_approval";
    }

    const updatedMembers = nextState
      ? room.members.map((m) => (m.agentId === assignee ? { ...m, liveState: nextState! } : m))
      : room.members;

    const updatedRoom: WarRoomSession = {
      ...room,
      members: Object.freeze(updatedMembers),
      kanbanBoard: Object.freeze(updatedBoard),
    };
    this.rooms.set(roomId, updatedRoom);
    return updatedRoom;
  }
}
