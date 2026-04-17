// CoreBlowProtocol/GatewayEnums.swift
// Typed enumerations for gateway protocol constants.
//
// The reference uses raw strings — CoreBlow uses enums
// for compile-time safety and exhaustive switch checking.

import Foundation

// MARK: - Error Codes

/// Standard error codes returned by the gateway.
public enum GatewayErrorCode: String, Codable, Sendable {
    case notLinked = "NOT_LINKED"
    case notPaired = "NOT_PAIRED"
    case agentTimeout = "AGENT_TIMEOUT"
    case invalidRequest = "INVALID_REQUEST"
    case approvalNotFound = "APPROVAL_NOT_FOUND"
    case unavailable = "UNAVAILABLE"
    case authFailed = "AUTH_FAILED"
    case rateLimited = "RATE_LIMITED"
    case protocolMismatch = "PROTOCOL_MISMATCH"
    case sessionNotFound = "SESSION_NOT_FOUND"
    case configInvalid = "CONFIG_INVALID"
}

// MARK: - Auth Detail Codes

/// Detail codes for connect auth failures.
public enum ConnectAuthDetailCode: String, Codable, Sendable {
    case authTokenMismatch = "auth_token_mismatch"
    case authDeviceTokenMismatch = "auth_device_token_mismatch"
    case authTokenMissing = "auth_token_missing"
    case authTokenNotConfigured = "auth_token_not_configured"
    case authPasswordMissing = "auth_password_missing"
    case authPasswordMismatch = "auth_password_mismatch"
    case authPasswordNotConfigured = "auth_password_not_configured"
    case authRateLimited = "auth_rate_limited"
    case pairingRequired = "pairing_required"
    case controlUiDeviceIdentityRequired = "control_ui_device_identity_required"
    case deviceIdentityRequired = "device_identity_required"
}

// MARK: - Auth Source

/// How the client authenticated with the gateway.
public enum GatewayAuthSource: String, Codable, Sendable {
    case deviceToken = "device-token"
    case sharedToken = "shared-token"
    case bootstrapToken = "bootstrap-token"
    case password = "password"
    case none = "none"
}

// MARK: - Client Mode

/// The mode in which the client is operating.
public enum ClientMode: String, Codable, Sendable {
    case ui
    case headless
    case cli
    case daemon
    case bridge
    case watch
}

// MARK: - Auth Mode

/// Gateway-side auth configuration mode.
public enum AuthMode: String, Codable, Sendable {
    case none
    case token
    case password
    case trustedProxy = "trusted-proxy"
    case tailscale
    case apiKey = "api-key"
    case bearer
    case hmac
}

// MARK: - WebSocket Close Codes

/// Well-known WebSocket close codes used by the gateway.
public enum GatewayCloseCode: Int, Sendable {
    case normalClosure = 1000
    case goingAway = 1001
    case protocolError = 1002
    case authFailed = 4001
    case sessionReplaced = 4002
    case serverRestart = 4003
    case seqDesync = 4004
    case rateLimited = 4029
}

// MARK: - RPC Methods

/// Well-known RPC method names for the gateway protocol.
public enum RPCMethod: String, Sendable {
    // Connection
    case connect
    // Agent
    case agent
    case agentIdentity = "agent.identity"
    case agentWait = "agent.wait"
    case agentAbort = "agent.abort"
    // Messaging
    case send
    case poll
    case wake
    // Node management
    case nodePairRequest = "node.pair.request"
    case nodePairList = "node.pair.list"
    case nodePairApprove = "node.pair.approve"
    case nodePairReject = "node.pair.reject"
    case nodePairVerify = "node.pair.verify"
    case nodeRename = "node.rename"
    case nodeList = "node.list"
    case nodeDescribe = "node.describe"
    case nodeInvoke = "node.invoke"
    case nodeInvokeResult = "node.invoke.result"
    case nodeEvent = "node.event"
    // Sessions
    case sessionsList = "sessions.list"
    case sessionsPreview = "sessions.preview"
    case sessionsResolve = "sessions.resolve"
    case sessionsCreate = "sessions.create"
    case sessionsSend = "sessions.send"
    case sessionsSubscribe = "sessions.messages.subscribe"
    case sessionsUnsubscribe = "sessions.messages.unsubscribe"
    case sessionsAbort = "sessions.abort"
    case sessionsPatch = "sessions.patch"
    case sessionsReset = "sessions.reset"
    case sessionsDelete = "sessions.delete"
    case sessionsCompact = "sessions.compact"
    case sessionsUsage = "sessions.usage"
    // Config
    case configGet = "config.get"
    case configSet = "config.set"
    case configApply = "config.apply"
    case configPatch = "config.patch"
    case configSchema = "config.schema"
    // Secrets
    case secretsReload = "secrets.reload"
    case secretsResolve = "secrets.resolve"
    // Push
    case pushTest = "push.test"
    // Cron
    case cronList = "cron.list"
    case cronAdd = "cron.add"
    case cronRemove = "cron.remove"
    case cronRun = "cron.run"
}

// MARK: - Event Names

/// Well-known event names pushed by the gateway.
public enum GatewayEventName: String, Sendable {
    case connectChallenge = "connect.challenge"
    case tick
    case presenceUpdate = "presence.update"
    case healthUpdate = "health.update"
    case agentStream = "agent.stream"
    case agentComplete = "agent.complete"
    case agentError = "agent.error"
    case configChanged = "config.changed"
    case sessionUpdate = "session.update"
    case sessionMessage = "session.message"
    case nodeApprovalRequest = "node.approval.request"
    case nodePaired = "node.paired"
}
