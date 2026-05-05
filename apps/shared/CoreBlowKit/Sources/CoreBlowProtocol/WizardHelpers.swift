import Foundation

public enum WizardHelpers {
    public static func validateGatewayURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else { return false }
        return url.scheme == "ws" || url.scheme == "wss" || url.scheme == "http" || url.scheme == "https"
    }
    public static func normalizeGatewayURL(_ urlString: String) -> String {
        var s = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if !s.contains("://") { s = "ws://\(s)" }
        if s.hasSuffix("/") { s.removeLast() }
        return s
    }
    public static func generatePairingCode() -> String {
        (0..<6).map { _ in String(Int.random(in: 0...9)) }.joined()
    }
}
