// CoreBlowKit/Gateway/DeepLinks.swift
// CoreBlow deep link URL construction and parsing.

import Foundation

public enum DeepLinkRoute: Sendable, Equatable {
    case agent(AgentDeepLink)
    case gateway(GatewayConnectDeepLink)
}

public struct GatewayConnectDeepLink: Codable, Sendable, Equatable {
    public let host: String
    public let port: Int
    public let tls: Bool
    public let bootstrapToken: String?
    public let token: String?
    public let password: String?

    public init(host: String, port: Int, tls: Bool, bootstrapToken: String?, token: String?, password: String?) {
        self.host = host
        self.port = port
        self.tls = tls
        self.bootstrapToken = bootstrapToken
        self.token = token
        self.password = password
    }

    public var websocketURL: URL? {
        let scheme = self.tls ? "wss" : "ws"
        return URL(string: "\(scheme)://\(self.host):\(self.port)")
    }

    public static func fromSetupCode(_ code: String) -> GatewayConnectDeepLink? {
        guard let data = Self.decodeBase64Url(code) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let urlString = json["url"] as? String,
              let parsed = URLComponents(string: urlString),
              let hostname = parsed.host,
              !hostname.isEmpty
        else { return nil }

        let scheme = (parsed.scheme ?? "ws").lowercased()
        guard scheme == "ws" || scheme == "wss" else { return nil }
        let tls = scheme == "wss"
        if !tls, !LoopbackHost.isLoopbackHost(hostname) {
            return nil
        }

        return GatewayConnectDeepLink(
            host: hostname,
            port: parsed.port ?? (tls ? 443 : 18789),
            tls: tls,
            bootstrapToken: json["bootstrapToken"] as? String,
            token: json["token"] as? String,
            password: json["password"] as? String)
    }

    private static func decodeBase64Url(_ input: String) -> Data? {
        var base64 = input
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(contentsOf: String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}

public struct AgentDeepLink: Codable, Sendable, Equatable {
    public let message: String
    public let sessionKey: String?
    public let thinking: String?
    public let deliver: Bool
    public let to: String?
    public let channel: String?
    public let timeoutSeconds: Int?
    public let key: String?

    public init(
        message: String,
        sessionKey: String?,
        thinking: String?,
        deliver: Bool,
        to: String?,
        channel: String?,
        timeoutSeconds: Int?,
        key: String?)
    {
        self.message = message
        self.sessionKey = sessionKey
        self.thinking = thinking
        self.deliver = deliver
        self.to = to
        self.channel = channel
        self.timeoutSeconds = timeoutSeconds
        self.key = key
    }
}

public enum DeepLinkParser {
    public static func parse(_ url: URL) -> DeepLinkRoute? {
        guard url.scheme?.lowercased() == CoreBlowDeepLink.scheme else { return nil }
        guard let host = url.host?.lowercased(), !host.isEmpty else { return nil }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }

        let query = (components.queryItems ?? []).reduce(into: [String: String]()) { values, item in
            guard let value = item.value else { return }
            values[item.name] = value
        }

        switch host {
        case "agent":
            guard let message = query["message"],
                  !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return nil }
            let deliver = (query["deliver"] as NSString?)?.boolValue ?? false
            let timeoutSeconds = query["timeoutSeconds"].flatMap { Int($0) }.flatMap { $0 >= 0 ? $0 : nil }
            return .agent(
                AgentDeepLink(
                    message: message,
                    sessionKey: query["sessionKey"],
                    thinking: query["thinking"],
                    deliver: deliver,
                    to: query["to"],
                    channel: query["channel"],
                    timeoutSeconds: timeoutSeconds,
                    key: query["key"]))

        case "gateway":
            guard let hostParam = query["host"],
                  !hostParam.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { return nil }
            let port = query["port"].flatMap { Int($0) } ?? 18789
            let tls = (query["tls"] as NSString?)?.boolValue ?? false
            if !tls, !LoopbackHost.isLoopbackHost(hostParam) {
                return nil
            }
            return .gateway(
                GatewayConnectDeepLink(
                    host: hostParam,
                    port: port,
                    tls: tls,
                    bootstrapToken: nil,
                    token: query["token"],
                    password: query["password"]))

        default:
            return nil
        }
    }
}

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
