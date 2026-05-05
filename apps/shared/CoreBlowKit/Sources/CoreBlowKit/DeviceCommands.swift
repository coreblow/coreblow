import Foundation
public enum DeviceCommands {
    public static func deviceInfo() -> [String: String] { ["name": Host.current().localizedName ?? "Unknown", "os": ProcessInfo.processInfo.operatingSystemVersionString, "arch": "arm64"] }
}
