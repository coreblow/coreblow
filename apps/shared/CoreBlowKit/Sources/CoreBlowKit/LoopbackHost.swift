import Foundation
public enum LoopbackHost { public static let ipv4 = "127.0.0.1"; public static let ipv6 = "::1"; public static func isLoopback(_ host: String) -> Bool { host == ipv4 || host == ipv6 || host == "localhost" } }
