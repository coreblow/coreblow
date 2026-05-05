import Foundation
public struct DeviceAuthPayload: Codable, Sendable {
    public let deviceId: String; public let deviceName: String; public let platform: String; public let capabilities: [String]; public let pairingCode: String?
    public init(deviceId: String, deviceName: String, platform: String, capabilities: [String], pairingCode: String? = nil) { self.deviceId = deviceId; self.deviceName = deviceName; self.platform = platform; self.capabilities = capabilities; self.pairingCode = pairingCode }
}
