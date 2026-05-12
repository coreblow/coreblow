// CoreBlowKit/Features/ShareToAgent.swift
// Share extension support for sharing content to agents.

import Foundation

/// Settings for the share-to-agent feature.
public struct ShareToAgentSettings: Sendable, Codable {
    public let enabled: Bool
    public let defaultAgentId: String?
    public let allowedMimeTypes: [String]
    public let maxFileSizeBytes: Int

    public init(enabled: Bool = true, defaultAgentId: String? = nil,
                allowedMimeTypes: [String] = ["image/*", "text/*", "application/pdf"],
                maxFileSizeBytes: Int = 10 * 1024 * 1024) {
        self.enabled = enabled; self.defaultAgentId = defaultAgentId
        self.allowedMimeTypes = allowedMimeTypes; self.maxFileSizeBytes = maxFileSizeBytes
    }
}

/// Gateway relay sharing settings.
public struct GatewayRelaySettings: Sendable, Codable {
    public let relayUrl: String?
    public let relayToken: String?
    public let relayEnabled: Bool

    public init(relayUrl: String? = nil, relayToken: String? = nil, relayEnabled: Bool = false) {
        self.relayUrl = relayUrl; self.relayToken = relayToken; self.relayEnabled = relayEnabled
    }
}

/// Build a share-to-agent deep link.
public enum ShareToAgentDeepLink {
    public static func build(text: String?, imageBase64: String? = nil, agentId: String? = nil) -> URL? {
        CoreBlowDeepLink.shareToAgentURL(text: text, imageUrl: imageBase64, agentId: agentId)
    }
}
