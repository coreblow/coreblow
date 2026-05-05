import Foundation

/// Canvas resolution and A2UI (Agent-to-UI) host URL helpers.
enum A2UIReadyState {
    case ready(String)
    case hostNotConfigured
    case hostUnavailable
}

extension NodeAppModel {

    func resolveCanvasHostURL() async -> String? {
        guard let config = gatewayConnection.activeConfig,
              let wsURL = config.wsURL else { return nil }
        let trimmed = wsURL.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let base = URL(string: trimmed) else { return nil }
        if let host = base.host, Self.isLoopback(host) {
            return nil
        }
        return base.appendingPathComponent("__coreblow__/canvas/").absoluteString
    }

    func resolveA2UIHostURL() async -> String? {
        guard let config = gatewayConnection.activeConfig,
              let wsURL = config.wsURL else { return nil }
        let trimmed = wsURL.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let base = URL(string: trimmed) else { return nil }
        if let host = base.host, Self.isLoopback(host) {
            return nil
        }
        return base.appendingPathComponent("__coreblow__/a2ui/").absoluteString + "?platform=ios"
    }

    func showA2UIOnConnectIfNeeded() async {
        await MainActor.run {
            lastAutoA2uiURL = nil
        }
    }

    func showLocalCanvasOnDisconnect() {
        lastAutoA2uiURL = nil
    }

    private static func isLoopback(_ host: String) -> Bool {
        let lower = host.lowercased()
        return lower == "localhost" || lower == "127.0.0.1" || lower == "::1"
    }
}
