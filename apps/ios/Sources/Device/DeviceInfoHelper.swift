import Foundation
#if canImport(UIKit)
import UIKit
#endif
import Darwin

/// Shared device and platform info for Settings, gateway node payloads, and device status.
enum DeviceInfoHelper {

    /// e.g. "iOS 18.1.0" or "iPadOS 18.1.0" by interface idiom.
    @MainActor
    static func platformString() -> String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        #if canImport(UIKit)
        let name: String = switch UIDevice.current.userInterfaceIdiom {
        case .pad: "iPadOS"
        case .phone: "iOS"
        default: "iOS"
        }
        #else
        let name = "iOS"
        #endif
        return "\(name) \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// Always "iOS X.Y.Z" for UI display, matching legacy behavior on iPad.
    static func platformStringForDisplay() -> String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "iOS \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// Device family for display: "iPad", "iPhone", or "iOS".
    @MainActor
    static func deviceFamily() -> String {
        #if canImport(UIKit)
        switch UIDevice.current.userInterfaceIdiom {
        case .pad: "iPad"
        case .phone: "iPhone"
        default: "iOS"
        }
        #else
        "iOS"
        #endif
    }

    /// Machine model identifier from uname (e.g. "iPhone17,1").
    static func modelIdentifier() -> String {
        var sysInfo = utsname()
        uname(&sysInfo)
        let bytes = withUnsafeBytes(of: &sysInfo.machine) { ptr in
            String(bytes: ptr.prefix { $0 != 0 }, encoding: .utf8)
        }
        let result = bytes?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return result.isEmpty ? "unknown" : result
    }

    /// App marketing version only, e.g. "2026.2.0" or "dev".
    static func appVersion() -> String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
    }

    /// App build string, e.g. "123" or "".
    static func appBuild() -> String {
        let raw = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Display string for Settings: "1.2.3" or "1.2.3 (456)" when build differs.
    static func coreBlowVersionString() -> String {
        let version = appVersion()
        let build = appBuild()
        if build.isEmpty || build == version {
            return version
        }
        return "\(version) (\(build))"
    }
}
