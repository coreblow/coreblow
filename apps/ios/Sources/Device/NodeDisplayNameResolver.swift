import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Generates and resolves human-readable display names for this node.
///
/// Pattern: caseless enum namespace (mirrors OC's NodeDisplayName).
enum NodeDisplayNameResolver {

    private static let placeholderNames: Set<String> = [
        "CoreBlow Node", "iPhone Node", "iPad Node", "iOS Node"
    ]

    /// Check if a name is a generic placeholder that should be replaced.
    static func isPlaceholder(_ name: String) -> Bool {
        placeholderNames.contains(name)
    }

    /// Generate a sensible default name for this device type.
    @MainActor
    static func defaultName() -> String {
        #if canImport(UIKit)
        switch UIDevice.current.userInterfaceIdiom {
        case .phone: return "iPhone Node"
        case .pad: return "iPad Node"
        default: return "CoreBlow Node"
        }
        #else
        return "CoreBlow Node"
        #endif
    }

    /// Resolve the best display name from available sources.
    ///
    /// Priority: user-set custom name > device name > default fallback
    @MainActor
    static func resolve(
        customName: String?,
        systemDeviceName: String
    ) -> String {
        // Prefer custom name if non-empty and non-placeholder
        if let custom = customName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !custom.isEmpty,
           !isPlaceholder(custom) {
            return custom
        }

        // Try the system device name if it looks meaningful
        let trimmedDevice = systemDeviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let meaningful = extractMeaningfulName(trimmedDevice) {
            return meaningful
        }

        return defaultName()
    }

    private static func extractMeaningfulName(_ deviceName: String) -> String? {
        guard !deviceName.isEmpty else { return nil }
        let lower = deviceName.lowercased()
        // Only accept names that reference actual device types
        let deviceKeywords = ["iphone", "ipad", "ipod", "mac"]
        guard deviceKeywords.contains(where: { lower.contains($0) }) else { return nil }
        return deviceName
    }
}
