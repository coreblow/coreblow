import Foundation
#if canImport(UIKit)
import UIKit
#endif
import Darwin

/// Stateless device metadata provider for gateway payloads and settings display.
///
/// Pattern: caseless `enum` as namespace (no instantiation).
/// OC pattern reference: enum-based static helpers.
enum DeviceInfoProvider {

    /// Hardware model identifier from uname (e.g. "iPhone16,2").
    static func machineIdentifier() -> String {
        var info = utsname()
        uname(&info)
        let bytes = Mirror(reflecting: info.machine).children.compactMap { $0.value as? Int8 }
        let raw = bytes.withUnsafeBufferPointer { ptr in
            String(cString: ptr.baseAddress!)
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "unknown-hw" : trimmed
    }

    /// Operating system version string (e.g. "iOS 18.1.0").
    @MainActor
    static func osVersionString() -> String {
        let ver = ProcessInfo.processInfo.operatingSystemVersion
        #if canImport(UIKit)
        let prefix: String = UIDevice.current.userInterfaceIdiom == .pad ? "iPadOS" : "iOS"
        #else
        let prefix = "iOS"
        #endif
        return "\(prefix) \(ver.majorVersion).\(ver.minorVersion).\(ver.patchVersion)"
    }

    /// Marketing version from Info.plist.
    static func appMarketingVersion() -> String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
    }

    /// Build number from Info.plist.
    static func appBuildNumber() -> String {
        let raw = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Combined version string for display: "1.2.0" or "1.2.0 (42)".
    static func coreBlowVersionLabel() -> String {
        let ver = appMarketingVersion()
        let build = appBuildNumber()
        guard !build.isEmpty, build != ver else { return ver }
        return "\(ver) (\(build))"
    }

    /// Device family label for categorization.
    @MainActor
    static func deviceFamilyLabel() -> String {
        #if canImport(UIKit)
        switch UIDevice.current.userInterfaceIdiom {
        case .phone: return "iPhone"
        case .pad: return "iPad"
        default: return "iOS"
        }
        #else
        return "iOS"
        #endif
    }
}
