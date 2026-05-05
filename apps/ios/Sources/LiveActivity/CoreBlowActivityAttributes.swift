#if canImport(ActivityKit)
import ActivityKit
#endif
import Foundation

/// Activity attributes for CoreBlow gateway status Live Activity.
struct CoreBlowActivityAttributes: ActivityAttributes {

    /// Static context visible throughout the activity's lifetime.
    let gatewayLabel: String

    /// Dynamic content state that changes over time.
    struct ContentState: Codable, Hashable {
        let isConnected: Bool
        let serverName: String?
        let lastUpdateMs: Int64
    }
}
