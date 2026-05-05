import Foundation
public enum LocalNetworkURLSupport {
    public static func isLocal(_ host: String) -> Bool { host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".local") || host.hasPrefix("192.168.") || host.hasPrefix("10.") }
    public static func buildURL(host: String, port: UInt16, tls: Bool, path: String = "") -> URL? { URL(string: "\(tls ? "https" : "http")://\(host):\(port)\(path)") }
}
