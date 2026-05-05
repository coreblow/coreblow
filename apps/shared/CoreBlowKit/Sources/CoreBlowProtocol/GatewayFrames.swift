// CoreBlowProtocol/GatewayFrames.swift
// Wire-level frame types for the CoreBlow gateway WebSocket protocol.
//
// Unlike the reference which uses raw String `type` fields, CoreBlow uses
// a typed enum discriminator for compile-time exhaustiveness checking.

import Foundation

/// Current protocol version negotiated between client and gateway.
public let COREBLOW_PROTOCOL_VERSION: Int = 3

// MARK: - Frame Type Discriminator

/// Typed discriminator for gateway frames (replaces raw string matching).
public enum FrameKind: String, Codable, Sendable {
    case request = "req"
    case response = "res"
    case event = "evt"
}

// MARK: - Request Frame

/// Client → Gateway RPC request.
public struct GatewayRequest: Codable, Sendable, Hashable {
    public let type: FrameKind
    public let id: String
    public let method: String
    public let params: FlexValue?

    public init(method: String, params: FlexValue? = nil, id: String? = nil) {
        self.type = .request
        self.id = id ?? UUID().uuidString
        self.method = method
        self.params = params
    }
}

// MARK: - Response Frame

/// Gateway → Client RPC response.
public struct GatewayResponse: Codable, Sendable {
    public let type: FrameKind
    public let id: String
    public let ok: Bool
    public let payload: FlexValue?
    public let error: [String: FlexValue]?

    public init(id: String, ok: Bool, payload: FlexValue? = nil, error: [String: FlexValue]? = nil) {
        self.type = .response
        self.id = id
        self.ok = ok
        self.payload = payload
        self.error = error
    }

    /// Extract error message string from the error dict.
    public var errorMessage: String? {
        error?["message"]?.stringValue
    }

    /// Extract structured error details.
    public var errorDetails: [String: FlexValue]? {
        guard case .object(let d) = error?["details"] else { return nil }
        return d
    }

    /// Extract error detail code string.
    public var errorDetailCode: String? {
        errorDetails?["code"]?.stringValue
    }
}

// MARK: - Event Frame

/// Gateway → Client push event.
public struct GatewayEvent: Codable, Sendable {
    public let type: FrameKind
    public let event: String
    public let payload: FlexValue?
    public let seq: Int?
    public let stateVersion: [String: FlexValue]?

    public init(event: String, payload: FlexValue? = nil, seq: Int? = nil, stateVersion: [String: FlexValue]? = nil) {
        self.type = .event
        self.event = event
        self.payload = payload
        self.seq = seq
        self.stateVersion = stateVersion
    }
}

// MARK: - Unified Frame Envelope

/// Discriminated union of all gateway frame types.
///
/// Uses a custom decoder to dispatch on the `type` field, avoiding
/// the fragile try-catch chain from the reference.
public enum GatewayFrame: Sendable {
    case request(GatewayRequest)
    case response(GatewayResponse)
    case event(GatewayEvent)
}

extension GatewayFrame: Codable {
    private enum DiscriminatorKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let peek = try decoder.container(keyedBy: DiscriminatorKeys.self)
        let kind = try peek.decode(FrameKind.self, forKey: .type)
        switch kind {
        case .request:
            self = .request(try GatewayRequest(from: decoder))
        case .response:
            self = .response(try GatewayResponse(from: decoder))
        case .event:
            self = .event(try GatewayEvent(from: decoder))
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .request(let r): try r.encode(to: encoder)
        case .response(let r): try r.encode(to: encoder)
        case .event(let e): try e.encode(to: encoder)
        }
    }
}

// MARK: - Frame Convenience

extension GatewayFrame {
    /// Extract the frame ID (available on request and response, nil on event).
    public var frameId: String? {
        switch self {
        case .request(let r): return r.id
        case .response(let r): return r.id
        case .event: return nil
        }
    }

    /// Extract event name if this is an event frame.
    public var eventName: String? {
        guard case .event(let e) = self else { return nil }
        return e.event
    }

    /// Check if this is a connect challenge event.
    public var isConnectChallenge: Bool {
        eventName == "connect.challenge"
    }

    /// Check if this is a tick event.
    public var isTick: Bool {
        eventName == "tick"
    }
}

// MARK: - Hello OK Payload

/// Payload returned by the gateway on successful connect handshake.
public struct HelloOkPayload: Codable, Sendable {
    public let tickIntervalMs: Double
    public let deviceToken: String?
    public let auth: [String: FlexValue]?
    public let canvasHostUrl: String?

    public init(
        tickIntervalMs: Double = 30_000,
        deviceToken: String? = nil,
        auth: [String: FlexValue]? = nil,
        canvasHostUrl: String? = nil
    ) {
        self.tickIntervalMs = tickIntervalMs
        self.deviceToken = deviceToken
        self.auth = auth
        self.canvasHostUrl = canvasHostUrl
    }
}
