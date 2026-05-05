import Foundation
enum Constants {
    static let appName = "CoreBlow"
    static let bundleIdentifier = "ai.coreblow.mac"
    static let gatewayServiceType = "_coreblow._tcp"
    static let defaultGatewayPort: UInt16 = 3000
    static let protocolVersion = 3
    static let heartbeatInterval: TimeInterval = 30
    static let reconnectDelay: TimeInterval = 5
    static let maxReconnectAttempts = 10
    static let controlSocketName = "control.sock"
}
