import Foundation

/// Tailscale network detection helpers.
public enum TailscaleNetwork {
    public static func isTailscaleIP(_ address: String) -> Bool {
        address.hasPrefix("100.") || address.hasPrefix("fd7a:115c:a1e0:")
    }

    public static func tailscaleHostname(from fullHostname: String) -> String? {
        let parts = fullHostname.split(separator: ".")
        guard parts.count >= 2, parts.last == "ts" || parts.last == "net" else { return nil }
        return String(parts.first ?? "")
    }
}
