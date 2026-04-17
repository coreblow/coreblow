// CoreBlowProtocol/GatewayModels.swift
// Data model types for the CoreBlow gateway protocol.
//
// Original implementation — uses FlexValue instead of AnyCodable,
// proper camelCase property names with CodingKeys for wire compat,
// and memberwise initializers with defaults for ergonomics.

import Foundation

// MARK: - Connect

/// Parameters sent by the client in a `connect` RPC request.
public struct ConnectParams: Codable, Sendable {
    public var minProtocol: Int
    public var maxProtocol: Int
    public var client: [String: FlexValue]
    public var caps: [String]?
    public var commands: [String]?
    public var permissions: [String: FlexValue]?
    public var pathEnv: String?
    public var role: String?
    public var scopes: [String]?
    public var device: [String: FlexValue]?
    public var auth: [String: FlexValue]?
    public var locale: String?
    public var userAgent: String?

    public init(
        minProtocol: Int = COREBLOW_PROTOCOL_VERSION,
        maxProtocol: Int = COREBLOW_PROTOCOL_VERSION,
        client: [String: FlexValue],
        caps: [String]? = nil,
        commands: [String]? = nil,
        permissions: [String: FlexValue]? = nil,
        pathEnv: String? = nil,
        role: String? = nil,
        scopes: [String]? = nil,
        device: [String: FlexValue]? = nil,
        auth: [String: FlexValue]? = nil,
        locale: String? = nil,
        userAgent: String? = nil
    ) {
        self.minProtocol = minProtocol
        self.maxProtocol = maxProtocol
        self.client = client
        self.caps = caps
        self.commands = commands
        self.permissions = permissions
        self.pathEnv = pathEnv
        self.role = role
        self.scopes = scopes
        self.device = device
        self.auth = auth
        self.locale = locale
        self.userAgent = userAgent
    }
}

// MARK: - Hello OK (Connect Response)

/// Payload returned after a successful `connect` handshake.
public struct HelloOkPayload: Codable, Sendable {
    public let type: String
    public let protocolVersion: Int
    public let server: [String: FlexValue]
    public let features: [String: FlexValue]
    public let snapshot: GatewaySnapshot
    public let canvasHostUrl: String?
    public let auth: [String: FlexValue]?
    public let policy: [String: FlexValue]

    private enum CodingKeys: String, CodingKey {
        case type
        case protocolVersion = "protocol"
        case server, features, snapshot
        case canvasHostUrl = "canvasHostUrl"
        case auth, policy
    }

    public init(
        type: String = "hello-ok",
        protocolVersion: Int = COREBLOW_PROTOCOL_VERSION,
        server: [String: FlexValue],
        features: [String: FlexValue] = [:],
        snapshot: GatewaySnapshot,
        canvasHostUrl: String? = nil,
        auth: [String: FlexValue]? = nil,
        policy: [String: FlexValue] = [:]
    ) {
        self.type = type
        self.protocolVersion = protocolVersion
        self.server = server
        self.features = features
        self.snapshot = snapshot
        self.canvasHostUrl = canvasHostUrl
        self.auth = auth
        self.policy = policy
    }

    /// Extract tick interval from policy, with sensible default.
    public var tickIntervalMs: Double {
        policy["tickIntervalMs"]?.doubleValue ?? 30_000.0
    }

    /// Extract device token from auth response (for storage).
    public var deviceToken: String? {
        auth?["deviceToken"]?.stringValue
    }
}

// MARK: - Snapshot

/// Server state snapshot included in hello-ok.
public struct GatewaySnapshot: Codable, Sendable {
    public let presence: [PresenceEntry]
    public let health: FlexValue
    public let stateVersion: StateVersion
    public let uptimeMs: Int
    public let configPath: String?
    public let stateDir: String?
    public let sessionDefaults: [String: FlexValue]?
    public let authMode: FlexValue?
    public let updateAvailable: [String: FlexValue]?

    public init(
        presence: [PresenceEntry] = [],
        health: FlexValue = .null,
        stateVersion: StateVersion = StateVersion(presence: 0, health: 0),
        uptimeMs: Int = 0,
        configPath: String? = nil,
        stateDir: String? = nil,
        sessionDefaults: [String: FlexValue]? = nil,
        authMode: FlexValue? = nil,
        updateAvailable: [String: FlexValue]? = nil
    ) {
        self.presence = presence
        self.health = health
        self.stateVersion = stateVersion
        self.uptimeMs = uptimeMs
        self.configPath = configPath
        self.stateDir = stateDir
        self.sessionDefaults = sessionDefaults
        self.authMode = authMode
        self.updateAvailable = updateAvailable
    }
}

// MARK: - Presence

/// A connected client's presence information.
public struct PresenceEntry: Codable, Sendable {
    public let host: String?
    public let ip: String?
    public let version: String?
    public let platform: String?
    public let deviceFamily: String?
    public let modelIdentifier: String?
    public let mode: String?
    public let lastInputSeconds: Int?
    public let reason: String?
    public let tags: [String]?
    public let text: String?
    public let ts: Int
    public let deviceId: String?
    public let roles: [String]?
    public let scopes: [String]?
    public let instanceId: String?

    public init(
        host: String? = nil, ip: String? = nil, version: String? = nil,
        platform: String? = nil, deviceFamily: String? = nil, modelIdentifier: String? = nil,
        mode: String? = nil, lastInputSeconds: Int? = nil, reason: String? = nil,
        tags: [String]? = nil, text: String? = nil, ts: Int,
        deviceId: String? = nil, roles: [String]? = nil, scopes: [String]? = nil,
        instanceId: String? = nil
    ) {
        self.host = host; self.ip = ip; self.version = version
        self.platform = platform; self.deviceFamily = deviceFamily
        self.modelIdentifier = modelIdentifier; self.mode = mode
        self.lastInputSeconds = lastInputSeconds; self.reason = reason
        self.tags = tags; self.text = text; self.ts = ts
        self.deviceId = deviceId; self.roles = roles; self.scopes = scopes
        self.instanceId = instanceId
    }
}

/// Protocol state version counters.
public struct StateVersion: Codable, Sendable {
    public let presence: Int
    public let health: Int

    public init(presence: Int, health: Int) {
        self.presence = presence
        self.health = health
    }
}

// MARK: - Error Shape

/// Structured error payload from the gateway.
public struct GatewayErrorShape: Codable, Sendable {
    public let code: String
    public let message: String
    public let details: FlexValue?
    public let retryable: Bool?
    public let retryAfterMs: Int?

    public init(code: String, message: String, details: FlexValue? = nil,
                retryable: Bool? = nil, retryAfterMs: Int? = nil) {
        self.code = code
        self.message = message
        self.details = details
        self.retryable = retryable
        self.retryAfterMs = retryAfterMs
    }
}

// MARK: - Agent

/// Parameters for starting an agent run.
public struct AgentRunParams: Codable, Sendable {
    public var message: String
    public var agentId: String?
    public var provider: String?
    public var model: String?
    public var to: String?
    public var replyTo: String?
    public var sessionId: String?
    public var sessionKey: String?
    public var thinking: String?
    public var deliver: Bool?
    public var attachments: [FlexValue]?
    public var channel: String?
    public var replyChannel: String?
    public var accountId: String?
    public var replyAccountId: String?
    public var threadId: String?
    public var groupId: String?
    public var groupChannel: String?
    public var groupSpace: String?
    public var timeout: Int?
    public var bestEffortDeliver: Bool?
    public var lane: String?
    public var extraSystemPrompt: String?
    public var internalEvents: [[String: FlexValue]]?
    public var inputProvenance: [String: FlexValue]?
    public var idempotencyKey: String
    public var label: String?

    public init(
        message: String,
        idempotencyKey: String = UUID().uuidString,
        agentId: String? = nil, provider: String? = nil, model: String? = nil,
        to: String? = nil, replyTo: String? = nil,
        sessionId: String? = nil, sessionKey: String? = nil,
        thinking: String? = nil, deliver: Bool? = nil,
        attachments: [FlexValue]? = nil, channel: String? = nil,
        replyChannel: String? = nil, accountId: String? = nil,
        replyAccountId: String? = nil, threadId: String? = nil,
        groupId: String? = nil, groupChannel: String? = nil, groupSpace: String? = nil,
        timeout: Int? = nil, bestEffortDeliver: Bool? = nil, lane: String? = nil,
        extraSystemPrompt: String? = nil, internalEvents: [[String: FlexValue]]? = nil,
        inputProvenance: [String: FlexValue]? = nil, label: String? = nil
    ) {
        self.message = message
        self.idempotencyKey = idempotencyKey
        self.agentId = agentId; self.provider = provider; self.model = model
        self.to = to; self.replyTo = replyTo
        self.sessionId = sessionId; self.sessionKey = sessionKey
        self.thinking = thinking; self.deliver = deliver
        self.attachments = attachments; self.channel = channel
        self.replyChannel = replyChannel; self.accountId = accountId
        self.replyAccountId = replyAccountId; self.threadId = threadId
        self.groupId = groupId; self.groupChannel = groupChannel; self.groupSpace = groupSpace
        self.timeout = timeout; self.bestEffortDeliver = bestEffortDeliver; self.lane = lane
        self.extraSystemPrompt = extraSystemPrompt; self.internalEvents = internalEvents
        self.inputProvenance = inputProvenance; self.label = label
    }
}

/// Agent stream event from a running agent.
public struct AgentStreamEvent: Codable, Sendable {
    public let runId: String
    public let seq: Int
    public let stream: String
    public let ts: Int
    public let data: [String: FlexValue]

    public init(runId: String, seq: Int, stream: String, ts: Int, data: [String: FlexValue]) {
        self.runId = runId
        self.seq = seq
        self.stream = stream
        self.ts = ts
        self.data = data
    }
}

/// Agent identity lookup.
public struct AgentIdentityParams: Codable, Sendable {
    public let agentId: String?
    public let sessionKey: String?

    public init(agentId: String? = nil, sessionKey: String? = nil) {
        self.agentId = agentId
        self.sessionKey = sessionKey
    }
}

public struct AgentIdentityResult: Codable, Sendable {
    public let agentId: String
    public let name: String?
    public let avatar: String?
    public let emoji: String?

    public init(agentId: String, name: String? = nil, avatar: String? = nil, emoji: String? = nil) {
        self.agentId = agentId
        self.name = name
        self.avatar = avatar
        self.emoji = emoji
    }
}

// MARK: - Messaging

/// Parameters for sending a message.
public struct SendMessageParams: Codable, Sendable {
    public var to: String
    public var message: String?
    public var mediaUrl: String?
    public var mediaUrls: [String]?
    public var gifPlayback: Bool?
    public var channel: String?
    public var accountId: String?
    public var agentId: String?
    public var threadId: String?
    public var sessionKey: String?
    public var idempotencyKey: String

    public init(to: String, message: String? = nil, idempotencyKey: String = UUID().uuidString,
                mediaUrl: String? = nil, mediaUrls: [String]? = nil,
                gifPlayback: Bool? = nil, channel: String? = nil,
                accountId: String? = nil, agentId: String? = nil,
                threadId: String? = nil, sessionKey: String? = nil) {
        self.to = to; self.message = message; self.idempotencyKey = idempotencyKey
        self.mediaUrl = mediaUrl; self.mediaUrls = mediaUrls
        self.gifPlayback = gifPlayback; self.channel = channel
        self.accountId = accountId; self.agentId = agentId
        self.threadId = threadId; self.sessionKey = sessionKey
    }
}

// MARK: - Node Pairing

public struct NodePairRequestParams: Codable, Sendable {
    public let nodeId: String
    public var displayName: String?
    public var platform: String?
    public var version: String?
    public var coreVersion: String?
    public var uiVersion: String?
    public var deviceFamily: String?
    public var modelIdentifier: String?
    public var caps: [String]?
    public var commands: [String]?
    public var remoteIp: String?
    public var silent: Bool?

    public init(nodeId: String, displayName: String? = nil, platform: String? = nil,
                version: String? = nil, coreVersion: String? = nil, uiVersion: String? = nil,
                deviceFamily: String? = nil, modelIdentifier: String? = nil,
                caps: [String]? = nil, commands: [String]? = nil,
                remoteIp: String? = nil, silent: Bool? = nil) {
        self.nodeId = nodeId; self.displayName = displayName; self.platform = platform
        self.version = version; self.coreVersion = coreVersion; self.uiVersion = uiVersion
        self.deviceFamily = deviceFamily; self.modelIdentifier = modelIdentifier
        self.caps = caps; self.commands = commands; self.remoteIp = remoteIp; self.silent = silent
    }
}

public struct NodePairApproveParams: Codable, Sendable {
    public let requestId: String
    public init(requestId: String) { self.requestId = requestId }
}

public struct NodePairRejectParams: Codable, Sendable {
    public let requestId: String
    public init(requestId: String) { self.requestId = requestId }
}

// MARK: - Sessions

public struct SessionsListParams: Codable, Sendable {
    public let agentId: String?
    public let limit: Int?
    public let offset: Int?
    public init(agentId: String? = nil, limit: Int? = nil, offset: Int? = nil) {
        self.agentId = agentId; self.limit = limit; self.offset = offset
    }
}

public struct SessionsSendParams: Codable, Sendable {
    public let sessionId: String
    public let message: String
    public let attachments: [FlexValue]?
    public let idempotencyKey: String
    public init(sessionId: String, message: String, attachments: [FlexValue]? = nil,
                idempotencyKey: String = UUID().uuidString) {
        self.sessionId = sessionId; self.message = message
        self.attachments = attachments; self.idempotencyKey = idempotencyKey
    }
}

// MARK: - Config

public struct ConfigSetParams: Codable, Sendable {
    public let key: String
    public let value: FlexValue
    public init(key: String, value: FlexValue) { self.key = key; self.value = value }
}

public struct ConfigPatchParams: Codable, Sendable {
    public let patches: [FlexValue]
    public init(patches: [FlexValue]) { self.patches = patches }
}

// MARK: - Wake

public struct WakeParams: Codable, Sendable {
    public let mode: FlexValue
    public let text: String
    public init(mode: FlexValue, text: String) { self.mode = mode; self.text = text }
}
