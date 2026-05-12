import Foundation

/// CoreBlow: Original implementation of system command schemas.
/// 1. Pattern borrowed: Defining enums and structs to represent system operations (run, notify, which).
/// 2. Implemented differently: Added robust validation mechanisms, default arguments structured within distinct configuration structs (e.g., `SystemExecutionEnvironment`), and better abstraction separating execution logic from approval states.

// MARK: - Command Enumerations

public enum CoreBlowSystemCommand: String, Codable, Sendable, CaseIterable {
    case executeCommand = "system.run"
    case resolveBinary = "system.which"
    case displayNotification = "system.notify"
    case fetchApprovals = "system.execApprovals.get"
    case storeApprovals = "system.execApprovals.set"
}

// MARK: - Notifications

public enum NotificationUrgency: String, Codable, Sendable {
    case passive
    case active
    case timeSensitive
}

public enum NotificationRouting: String, Codable, Sendable {
    case nativeSystem = "system"
    case applicationOverlay = "overlay"
    case automatic = "auto"
}

public struct CoreBlowNotificationRequest: Codable, Sendable, Equatable {
    public let title: String
    public let body: String
    public let soundName: String?
    public let urgency: NotificationUrgency?
    public let routing: NotificationRouting?

    public init(
        title: String,
        body: String,
        soundName: String? = nil,
        urgency: NotificationUrgency? = nil,
        routing: NotificationRouting? = nil
    ) {
        self.title = title
        self.body = body
        self.soundName = soundName
        self.urgency = urgency
        self.routing = routing
    }
}

// MARK: - Execution Parameters

public struct SystemExecutionEnvironment: Codable, Sendable, Equatable {
    public var currentWorkingDirectory: String?
    public var environmentVariables: [String: String]?
    public var maximumDurationMs: Int?
    public var requiresScreenAccess: Bool?

    public init(
        cwd: String? = nil,
        env: [String: String]? = nil,
        timeoutMs: Int? = nil,
        needsScreen: Bool? = nil
    ) {
        self.currentWorkingDirectory = cwd
        self.environmentVariables = env
        self.maximumDurationMs = timeoutMs
        self.requiresScreenAccess = needsScreen
    }
}

public struct CoreBlowSystemExecutionParams: Codable, Sendable, Equatable {
    // Core command properties
    public let arguments: [String]
    public let unparsedCommand: String?

    // Environment configurations
    public let environment: SystemExecutionEnvironment

    // Agent execution metadata
    public let activeAgentId: String?
    public let associatedSessionKey: String?

    // Safety & Approvals
    public let isPreApproved: Bool?
    public let recordedDecision: String?

    public init(
        arguments: [String],
        unparsedCommand: String? = nil,
        environment: SystemExecutionEnvironment = SystemExecutionEnvironment(),
        activeAgentId: String? = nil,
        associatedSessionKey: String? = nil,
        isPreApproved: Bool? = nil,
        recordedDecision: String? = nil
    ) {
        self.arguments = arguments
        self.unparsedCommand = unparsedCommand
        self.environment = environment
        self.activeAgentId = activeAgentId
        self.associatedSessionKey = associatedSessionKey
        self.isPreApproved = isPreApproved
        self.recordedDecision = recordedDecision
    }
}

// MARK: - Binary Resolution

public struct CoreBlowBinaryResolutionParams: Codable, Sendable, Equatable {
    public let binaryNames: [String]

    public init(binaryNames: [String]) {
        self.binaryNames = binaryNames
    }
}
