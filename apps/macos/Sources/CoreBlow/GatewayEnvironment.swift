import Foundation
enum GatewayEnvironment {
    static var isDebug: Bool { #if DEBUG; return true; #else; return false; #endif }
    static var appVersion: String { Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0" }
    static var buildNumber: String { Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0" }
    static var userAgent: String { "CoreBlow/\(appVersion) macOS/\(ProcessInfo.processInfo.operatingSystemVersionString)" }
}
