import Foundation

/// Builds human-readable gateway status labels from connection state.
enum GatewayStatusBuilder {

    static func statusText(
        connected: Bool,
        serverName: String?,
        remoteAddress: String?,
        isReconnecting: Bool
    ) -> String {
        if isReconnecting { return "Reconnecting…" }
        guard connected else { return "Offline" }
        if let name = serverName, !name.isEmpty {
            return "Connected to \(name)"
        }
        if let addr = remoteAddress, !addr.isEmpty {
            return "Connected (\(addr))"
        }
        return "Connected"
    }

    static func nodeStatusText(connected: Bool) -> String {
        connected ? "Online" : "Offline"
    }

    static func operatorStatusText(connected: Bool) -> String {
        connected ? "Active" : "Offline"
    }

    static func shortLabel(connected: Bool) -> String {
        connected ? "Connected" : "Offline"
    }

    static func colorName(connected: Bool) -> String {
        connected ? "green" : "gray"
    }
}
