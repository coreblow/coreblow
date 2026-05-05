import Foundation
public enum CoreBlowDeepLinks {
    public static let scheme = "coreblow"
    public enum Action: String { case connect, settings, agent, canvas, pair }
    public static func parse(_ url: URL) -> (action: Action, params: [String: String])? {
        guard url.scheme == scheme, let host = url.host, let action = Action(rawValue: host) else { return nil }
        var params: [String: String] = [:]
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.forEach { params[$0.name] = $0.value }
        return (action, params)
    }
    public static func build(action: Action, params: [String: String] = [:]) -> URL? {
        var components = URLComponents(); components.scheme = scheme; components.host = action.rawValue
        if !params.isEmpty { components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) } }
        return components.url
    }
}
