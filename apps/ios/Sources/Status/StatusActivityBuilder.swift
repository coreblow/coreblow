import SwiftUI

/// Builds Live Activity content for gateway status display.
enum StatusActivityBuilder {

    struct ActivityContent {
        let title: String
        let status: String
        let icon: String
        let tintHex: String
    }

    static func connectedActivity(serverName: String?) -> ActivityContent {
        ActivityContent(
            title: "CoreBlow",
            status: serverName.map { "Connected to \($0)" } ?? "Connected",
            icon: "bolt.fill",
            tintHex: "#34C759")
    }

    static func disconnectedActivity() -> ActivityContent {
        ActivityContent(
            title: "CoreBlow",
            status: "Offline",
            icon: "bolt.slash",
            tintHex: "#8E8E93")
    }

    static func reconnectingActivity() -> ActivityContent {
        ActivityContent(
            title: "CoreBlow",
            status: "Reconnecting…",
            icon: "arrow.triangle.2.circlepath",
            tintHex: "#FF9F0A")
    }
}
