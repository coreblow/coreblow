import Foundation

/// Push notification transport modes.
enum PushTransportMode: String {
    case apns = "apns"
    case relay = "relay"
    case disabled = "disabled"
}

/// Distribution mode for build variants.
enum PushDistributionMode: String {
    case debug = "debug"
    case testflight = "testflight"
    case appstore = "appstore"
}

/// APNs environment determined by provisioning.
enum PushAPNsEnvironment: String {
    case development = "development"
    case production = "production"
}

/// Build-time push notification configuration.
struct PushBuildConfig {
    let transportMode: PushTransportMode
    let distributionMode: PushDistributionMode
    let apnsEnvironment: PushAPNsEnvironment
    let relayBaseURL: String?

    static let `default` = PushBuildConfig(
        transportMode: .relay,
        distributionMode: .debug,
        apnsEnvironment: .development,
        relayBaseURL: nil)

    /// Whether push notifications are active.
    var isEnabled: Bool {
        transportMode != .disabled
    }

    /// Whether the relay server is used instead of direct APNs.
    var usesRelay: Bool {
        transportMode == .relay
    }
}
