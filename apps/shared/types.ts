/**
 * CoreBlow — Shared Cross-Platform DTO Contracts
 *
 * Sovereign Data-Oriented Programming (DOP) contracts shared across:
 * - Desktop Canvas & Companion Bar (macOS AppKit/SwiftUI)
 * - Mobile Cockpit (iOS SwiftUI & watchOS)
 * - Android Jetpack Compose Surface
 * - CoreBlow Microkernel RPC Fleet (Port 18789)
 */

export type DesktopStudioRouteTier = "fast" | "deep" | "local" | "coding" | "vision" | "decision";

export type DesktopStudioLiveStatus =
  | "idle"
  | "thinking"
  | "running_tools"
  | "ready_for_review"
  | "blocked";

export interface DesktopStudioThreadSummary {
  readonly threadId: string;
  readonly title: string;
  readonly mode: "single_agent" | "war_room";
  readonly routeTier: DesktopStudioRouteTier;
  readonly liveStatus: DesktopStudioLiveStatus;
  readonly activeSkillsCount: number;
  readonly updatedAtMs: number;
}

export interface DesktopWorktreeChangedFile {
  readonly filePath: string;
  readonly additions: number;
  readonly deletions: number;
  readonly status: "added" | "modified" | "deleted";
}

export interface DesktopWorktreeGateCheck {
  readonly name: "typecheck" | "linter" | "unit_tests" | "secret_scan" | "forbidden_paths";
  readonly passed: boolean;
  readonly detail: string;
}

export interface DesktopWorktreeDiffView {
  readonly prId?: string;
  readonly branchName: string;
  readonly changedFiles: ReadonlyArray<DesktopWorktreeChangedFile>;
  readonly unifiedDiff: string;
  readonly preFlightGatesPassed: boolean;
  readonly gateChecks: ReadonlyArray<DesktopWorktreeGateCheck>;
}

export interface DesktopVoiceTelemetry {
  readonly backend: string;
  readonly rtf: number;
  readonly meetsSovereignTarget: boolean; // RTF <= 0.4 on Apple Silicon Neural Engine
}

export interface DesktopStudioSnapshot {
  readonly companionShortcut: "Option+Space";
  readonly pairedApp?: {
    readonly bundleId: string;
    readonly appName: string;
    readonly windowTitle?: string;
    readonly activeFilePath?: string;
    readonly workingDirectory?: string;
  };
  readonly activeThreads: readonly DesktopStudioThreadSummary[];
  readonly worktreeInspector: DesktopWorktreeDiffView;
  readonly voiceTelemetry: DesktopVoiceTelemetry;
  readonly memoryWikiPagesCount: number;
  readonly verifiedSkillsCount: number;
  readonly lockedSkillsCount: number;
}

// ── War Room & Kanban Models ────────────────────────────────────────────────

export type WarRoomSubagentRole = "lead" | "coder" | "auditor" | "verifier";
export type KanbanColumn = "Backlog" | "In Progress" | "Review" | "Done";

export interface KanbanCard {
  readonly id: string;
  readonly title: string;
  readonly role: WarRoomSubagentRole;
  readonly column: KanbanColumn;
  readonly durationMs?: number;
  readonly avatarInitials?: string;
}

export interface WarRoomSummary {
  readonly warRoomId: string;
  readonly title: string;
  readonly activeAgentsCount: number;
  readonly cards: readonly KanbanCard[];
  readonly status: "planning" | "active" | "review" | "completed";
}

// ── PR Remote Actions ───────────────────────────────────────────────────────

export interface PrApprovalPayload {
  readonly prId: string;
  readonly approvedBy: string;
  readonly timestampMs: number;
  readonly certifiedGates: readonly string[];
}

export interface PrRollbackPayload {
  readonly prId: string;
  readonly reason: string;
  readonly requestedBy: string;
  readonly targetCommitSha?: string;
}

// ── Legacy CoreBlow Compatibility ──────────────────────────────────────────

export interface AppState {
  readonly connected: boolean;
  readonly model: string;
  readonly messages: readonly any[];
}
