import Foundation
public struct DeviceIdentity: Codable, Sendable {
    public let id: String; public let name: String; public let platform: String; public let model: String?
    public static func current() -> DeviceIdentity {
        let id = UserDefaults.standard.string(forKey: "coreblow.deviceId") ?? { let new = UUID().uuidString; UserDefaults.standard.set(new, forKey: "coreblow.deviceId"); return new }()
        return DeviceIdentity(id: id, name: Host.current().localizedName ?? "Mac", platform: "macOS", model: nil)
    }
}
