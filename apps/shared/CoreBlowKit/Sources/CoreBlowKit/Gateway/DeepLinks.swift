// CoreBlowKit/Gateway/DeepLinks.swift
// CoreBlow deep link URL construction and parsing.

import Foundation

/// CoreBlow deep link URL schemes and construction.
public enum CoreBlowDeepLink {
    /// Custom URL scheme for CoreBlow.
    public static let scheme = "coreblow"

    /// Standard deep link paths.
    public enum Path: String, Sendable {
        case connect = "/connect"
        case pair = "/pair"
        case chat = "/chat"
        case session = "/session"
        case agent = "/agent"
        case settings = "/settings"
        case canvas = "/canvas"
        case shareToAgent = "/share-to-agent"
    }

    /// Build a connect deep link URL.
    public static func connectURL(host: String, port: Int? = nil, token: String? = nil) -> URL? {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "gateway"
        components.path = Path.connect.rawValue
        var items: [URLQueryItem] = [URLQueryItem(name: "host", value: host)]
        if let port { items.append(URLQueryItem(name: "port", value: String(port))) }
        if let token { items.append(URLQueryItem(name: "token", value: token)) }
        components.queryItems = items
        return components.url
    }

    /// Build a chat deep link URL.
    public static func chatURL(sessionKey: String? = nil, agentId: String? = nil) -> URL? {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "app"
        components.path = Path.chat.rawValue
        var items: [URLQueryItem] = []
        if let sessionKey { items.append(URLQueryItem(name: "sessionKey", value: sessionKey)) }
        if let agentId { items.append(URLQueryItem(name: "agentId", value: agentId)) }
        if !items.isEmpty { components.queryItems = items }
        return components.url
    }

    /// Build a share-to-agent deep link URL.
    public static func shareToAgentURL(
        text: String? = nil,
        imageUrl: String? = nil,
        agentId: String? = nil
    ) -> URL? {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "app"
        components.path = Path.shareToAgent.rawValue
        var items: [URLQueryItem] = []
        if let text { items.append(URLQueryItem(name: "text", value: text)) }
        if let imageUrl { items.append(URLQueryItem(name: "imageUrl", value: imageUrl)) }
        if let agentId { items.append(URLQueryItem(name: "agentId", value: agentId)) }
        if !items.isEmpty { components.queryItems = items }
        return components.url
    }

    /// Parse a CoreBlow deep link URL into components.
    public static func parse(_ url: URL) -> (path: Path, params: [String: String])? {
        guard url.scheme == scheme else { return nil }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        guard let pathString = components?.path,
              let path = Path(rawValue: pathString)
        else { return nil }
        let params = (components?.queryItems ?? []).reduce(into: [String: String]()) { dict, item in
            if let value = item.value { dict[item.name] = value }
        }
        return (path, params)
    }
}
