// CoreBlowKit/Gateway/BridgeFrames.swift
// Frame types for the local node bridge protocol (device ↔ gateway LAN).
//
// Uses typed BridgeFrameKind enum instead of raw strings.

import Foundation
import CoreBlowProtocol

// MARK: - Bridge Frame Kind

/// Discriminator for bridge protocol frames.
public enum BridgeFrameKind: String, Codable, Sendable {
    case hello
    case helloOk = "hello-ok"
    case pairRequest = "pair-request"
    case pairOk = "pair-ok"
    case invoke
    case invokeResponse = "invoke-res"
    case event
    case ping
    case pong
    case error
    case req
    case res
}

// MARK: - Bridge Invoke

/// Node → Gateway command invocation.
public struct BridgeInvokeRequest: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public let command: String
    public let paramsJSON: String?

    public init(id: String = UUID().uuidString, command: String, paramsJSON: String? = nil) {
        self.type = .invoke; self.id = id; self.command = command; self.paramsJSON = paramsJSON
    }
}

/// Gateway → Node invoke response.
public struct BridgeInvokeResponse: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public let ok: Bool
    public let payloadJSON: String?
    public let error: NodeError?

    public init(id: String, ok: Bool, payloadJSON: String? = nil, error: NodeError? = nil) {
        self.type = .invokeResponse; self.id = id; self.ok = ok
        self.payloadJSON = payloadJSON; self.error = error
    }
}

// MARK: - Bridge Events

/// Node → Gateway push event.
public struct BridgeEventFrame: Codable, Sendable {
    public let type: BridgeFrameKind
    public let event: String
    public let payloadJSON: String?

    public init(event: String, payloadJSON: String? = nil) {
        self.type = .event; self.event = event; self.payloadJSON = payloadJSON
    }
}

// MARK: - Bridge Hello (Node → Gateway)

/// Initial handshake from node to gateway.
public struct BridgeHello: Codable, Sendable {
    public let type: BridgeFrameKind
    public let nodeId: String
    public let displayName: String?
    public let token: String?
    public let platform: String?
    public let version: String?
    public let coreVersion: String?
    public let uiVersion: String?
    public let deviceFamily: String?
    public let modelIdentifier: String?
    public let caps: [String]?
    public let commands: [String]?
    public let permissions: [String: Bool]?

    public init(
        nodeId: String, displayName: String? = nil, token: String? = nil,
        platform: String? = nil, version: String? = nil,
        coreVersion: String? = nil, uiVersion: String? = nil,
        deviceFamily: String? = nil, modelIdentifier: String? = nil,
        caps: [String]? = nil, commands: [String]? = nil,
        permissions: [String: Bool]? = nil
    ) {
        self.type = .hello; self.nodeId = nodeId; self.displayName = displayName
        self.token = token; self.platform = platform; self.version = version
        self.coreVersion = coreVersion; self.uiVersion = uiVersion
        self.deviceFamily = deviceFamily; self.modelIdentifier = modelIdentifier
        self.caps = caps; self.commands = commands; self.permissions = permissions
    }
}

/// Gateway → Node hello acknowledgment.
public struct BridgeHelloOk: Codable, Sendable {
    public let type: BridgeFrameKind
    public let serverName: String
    public let canvasHostUrl: String?
    public let mainSessionKey: String?

    public init(serverName: String, canvasHostUrl: String? = nil, mainSessionKey: String? = nil) {
        self.type = .helloOk; self.serverName = serverName
        self.canvasHostUrl = canvasHostUrl; self.mainSessionKey = mainSessionKey
    }
}

// MARK: - Bridge Pairing

/// Pairing request (node → gateway).
public struct BridgePairRequest: Codable, Sendable {
    public let type: BridgeFrameKind
    public let nodeId: String
    public let displayName: String?
    public let platform: String?
    public let version: String?
    public let coreVersion: String?
    public let uiVersion: String?
    public let deviceFamily: String?
    public let modelIdentifier: String?
    public let caps: [String]?
    public let commands: [String]?
    public let permissions: [String: Bool]?
    public let remoteAddress: String?
    public let silent: Bool?

    public init(
        nodeId: String, displayName: String? = nil, platform: String? = nil,
        version: String? = nil, coreVersion: String? = nil, uiVersion: String? = nil,
        deviceFamily: String? = nil, modelIdentifier: String? = nil,
        caps: [String]? = nil, commands: [String]? = nil, permissions: [String: Bool]? = nil,
        remoteAddress: String? = nil, silent: Bool? = nil
    ) {
        self.type = .pairRequest; self.nodeId = nodeId; self.displayName = displayName
        self.platform = platform; self.version = version; self.coreVersion = coreVersion
        self.uiVersion = uiVersion; self.deviceFamily = deviceFamily
        self.modelIdentifier = modelIdentifier; self.caps = caps; self.commands = commands
        self.permissions = permissions; self.remoteAddress = remoteAddress; self.silent = silent
    }
}

/// Pairing success response.
public struct BridgePairOk: Codable, Sendable {
    public let type: BridgeFrameKind
    public let token: String
    public init(token: String) { self.type = .pairOk; self.token = token }
}

// MARK: - Bridge Ping/Pong

public struct BridgePing: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public init(id: String = UUID().uuidString) { self.type = .ping; self.id = id }
}

public struct BridgePong: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public init(id: String) { self.type = .pong; self.id = id }
}

// MARK: - Bridge Error

public struct BridgeErrorFrame: Codable, Sendable {
    public let type: BridgeFrameKind
    public let code: String
    public let message: String
    public init(code: String, message: String) {
        self.type = .error; self.code = code; self.message = message
    }
}

// MARK: - Bridge RPC (Node → Gateway)

public struct BridgeRPCRequest: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public let method: String
    public let paramsJSON: String?

    public init(id: String = UUID().uuidString, method: String, paramsJSON: String? = nil) {
        self.type = .req; self.id = id; self.method = method; self.paramsJSON = paramsJSON
    }
}

public struct BridgeRPCResponse: Codable, Sendable {
    public let type: BridgeFrameKind
    public let id: String
    public let ok: Bool
    public let payloadJSON: String?
    public let error: NodeError?

    public init(id: String, ok: Bool, payloadJSON: String? = nil, error: NodeError? = nil) {
        self.type = .res; self.id = id; self.ok = ok
        self.payloadJSON = payloadJSON; self.error = error
    }
}

// MARK: - Node Error

/// Typed error from node command execution.
public struct NodeError: Codable, Sendable, Equatable {
    public let code: String
    public let message: String
    public init(code: String, message: String) { self.code = code; self.message = message }
}
