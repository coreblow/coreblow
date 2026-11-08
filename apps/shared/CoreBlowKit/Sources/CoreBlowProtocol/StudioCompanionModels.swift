//
// CoreBlow — Shared Cross-Platform Studio & Companion Models
//
// Shared DOP Contracts across:
// - macOS CoreBlow Studio & Companion Bar
// - iOS & watchOS Native Companion Cockpit
// - Microkernel JSON-RPC Gateway (Port 18789)
//

import Foundation

public enum DesktopStudioRouteTier: String, Codable, Sendable, CaseIterable {
    case fast
    case deep
    case local
    case coding
    case vision
    case decision
}

public enum DesktopStudioLiveStatus: String, Codable, Sendable, CaseIterable {
    case idle
    case thinking
    case runningTools = "running_tools"
    case readyForReview = "ready_for_review"
    case blocked
}

public struct DesktopStudioThreadSummary: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let mode: String // "single_agent" | "war_room"
    public let routeTier: DesktopStudioRouteTier
    public let liveStatus: DesktopStudioLiveStatus
    public let activeSkillsCount: Int
    public let updatedAtMs: Double

    enum CodingKeys: String, CodingKey {
        case id = "threadId"
        case title
        case mode
        case routeTier
        case liveStatus
        case activeSkillsCount
        case updatedAtMs
    }

    public init(
        id: String,
        title: String,
        mode: String,
        routeTier: DesktopStudioRouteTier,
        liveStatus: DesktopStudioLiveStatus,
        activeSkillsCount: Int,
        updatedAtMs: Double
    ) {
        self.id = id
        self.title = title
        self.mode = mode
        self.routeTier = routeTier
        self.liveStatus = liveStatus
        self.activeSkillsCount = activeSkillsCount
        self.updatedAtMs = updatedAtMs
    }
}

public struct DesktopWorktreeChangedFile: Codable, Sendable, Hashable, Identifiable {
    public var id: String { self.filePath }
    public let filePath: String
    public let additions: Int
    public let deletions: Int
    public let status: String // "added" | "modified" | "deleted"

    public init(filePath: String, additions: Int, deletions: Int, status: String) {
        self.filePath = filePath
        self.additions = additions
        self.deletions = deletions
        self.status = status
    }
}

public struct DesktopWorktreeGateCheck: Codable, Sendable, Hashable, Identifiable {
    public var id: String { self.name }
    public let name: String // "typecheck" | "linter" | "unit_tests" | "secret_scan" | "forbidden_paths"
    public let passed: Bool
    public let detail: String

    public init(name: String, passed: Bool, detail: String) {
        self.name = name
        self.passed = passed
        self.detail = detail
    }
}

public struct DesktopWorktreeDiffView: Codable, Sendable, Hashable {
    public let prId: String?
    public let branchName: String
    public let changedFiles: [DesktopWorktreeChangedFile]
    public let unifiedDiff: String
    public let preFlightGatesPassed: Bool
    public let gateChecks: [DesktopWorktreeGateCheck]

    public init(
        prId: String? = nil,
        branchName: String,
        changedFiles: [DesktopWorktreeChangedFile],
        unifiedDiff: String,
        preFlightGatesPassed: Bool,
        gateChecks: [DesktopWorktreeGateCheck]
    ) {
        self.prId = prId
        self.branchName = branchName
        self.changedFiles = changedFiles
        self.unifiedDiff = unifiedDiff
        self.preFlightGatesPassed = preFlightGatesPassed
        self.gateChecks = gateChecks
    }
}

public struct DesktopVoiceTelemetry: Codable, Sendable, Hashable {
    public let backend: String
    public let rtf: Double
    public let meetsSovereignTarget: Bool // RTF <= 0.4 on Apple Silicon Neural Engine

    public init(backend: String, rtf: Double, meetsSovereignTarget: Bool) {
        self.backend = backend
        self.rtf = rtf
        self.meetsSovereignTarget = meetsSovereignTarget
    }
}

public struct DesktopStudioSnapshot: Codable, Sendable, Hashable {
    public let companionShortcut: String
    public let activeThreads: [DesktopStudioThreadSummary]
    public let worktreeInspector: DesktopWorktreeDiffView
    public let voiceTelemetry: DesktopVoiceTelemetry
    public let memoryWikiPagesCount: Int
    public let verifiedSkillsCount: Int
    public let lockedSkillsCount: Int

    public init(
        companionShortcut: String = "Option+Space",
        activeThreads: [DesktopStudioThreadSummary],
        worktreeInspector: DesktopWorktreeDiffView,
        voiceTelemetry: DesktopVoiceTelemetry,
        memoryWikiPagesCount: Int,
        verifiedSkillsCount: Int,
        lockedSkillsCount: Int
    ) {
        self.companionShortcut = companionShortcut
        self.activeThreads = activeThreads
        self.worktreeInspector = worktreeInspector
        self.voiceTelemetry = voiceTelemetry
        self.memoryWikiPagesCount = memoryWikiPagesCount
        self.verifiedSkillsCount = verifiedSkillsCount
        self.lockedSkillsCount = lockedSkillsCount
    }
}

// ============================================================================
// War Room & Mobile Kanban Models
// ============================================================================

public enum WarRoomSubagentRole: String, Codable, Sendable, CaseIterable {
    case lead
    case coder
    case auditor
    case verifier

    public var badgeTitle: String {
        switch self {
        case .lead: return "LEAD ARCHITECT"
        case .coder: return "DEEP CODER"
        case .auditor: return "SECURITY AUDITOR"
        case .verifier: return "PRE-FLIGHT VERIFIER"
        }
    }
}

public enum KanbanColumn: String, Codable, Sendable, CaseIterable, Identifiable {
    case backlog = "Backlog"
    case inProgress = "In Progress"
    case review = "Review"
    case done = "Done"

    public var id: String { self.rawValue }
}

public struct KanbanCard: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let role: WarRoomSubagentRole
    public let column: KanbanColumn
    public let durationMs: Double?
    public let avatarInitials: String?

    public init(
        id: String,
        title: String,
        role: WarRoomSubagentRole,
        column: KanbanColumn,
        durationMs: Double? = nil,
        avatarInitials: String? = nil
    ) {
        self.id = id
        self.title = title
        self.role = role
        self.column = column
        self.durationMs = durationMs
        self.avatarInitials = avatarInitials
    }
}

public struct WarRoomSummary: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let activeAgentsCount: Int
    public let cards: [KanbanCard]
    public let status: String

    public init(
        id: String,
        title: String,
        activeAgentsCount: Int,
        cards: [KanbanCard],
        status: String
    ) {
        self.id = id
        self.title = title
        self.activeAgentsCount = activeAgentsCount
        self.cards = cards
        self.status = status
    }
}

// ============================================================================
// PR Remote Action Payloads
// ============================================================================

public struct PrApprovalPayload: Codable, Sendable {
    public let prId: String
    public let approvedBy: String
    public let timestampMs: Double
    public let certifiedGates: [String]

    public init(prId: String, approvedBy: String, timestampMs: Double, certifiedGates: [String]) {
        self.prId = prId
        self.approvedBy = approvedBy
        self.timestampMs = timestampMs
        self.certifiedGates = certifiedGates
    }
}

public struct PrRollbackPayload: Codable, Sendable {
    public let prId: String
    public let reason: String
    public let requestedBy: String
    public let targetCommitSha: String?

    public init(prId: String, reason: String, requestedBy: String, targetCommitSha: String? = nil) {
        self.prId = prId
        self.reason = reason
        self.requestedBy = requestedBy
        self.targetCommitSha = targetCommitSha
    }
}
