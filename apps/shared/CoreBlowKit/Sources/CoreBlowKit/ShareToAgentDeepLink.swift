import Foundation
public enum ShareToAgentDeepLink { public static func build(text: String, session: String? = nil) -> URL? { var c = URLComponents(); c.scheme = "coreblow"; c.host = "agent"; c.queryItems = [URLQueryItem(name: "text", value: text)]; if let s = session { c.queryItems?.append(URLQueryItem(name: "session", value: s)) }; return c.url } }
