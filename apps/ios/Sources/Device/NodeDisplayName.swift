import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Generates and resolves human-readable display names for this node.
enum NodeDisplayName {
    private static let genericNames: Set<String> = ["iOS Node", "iPhone Node", "iPad Node"]

    static func isGeneric(_ name: String) -> Bool {
        genericNames.contains(name)
    }

    @MainActor
    static func defaultValue(for interfaceIdiom: Int) -> String {
        #if canImport(UIKit)
        switch UIUserInterfaceIdiom(rawValue: interfaceIdiom) {
        case .phone: return "iPhone Node"
        case .pad: return "iPad Node"
        default: return "iOS Node"
        }
        #else
        return "iOS Node"
        #endif
    }

    @MainActor
    static func resolve(
        existing: String?,
        deviceName: String,
        interfaceIdiom: Int
    ) -> String {
        let trimmedExisting = existing?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmedExisting.isEmpty, !isGeneric(trimmedExisting) {
            return trimmedExisting
        }

        let trimmedDevice = deviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let normalized = normalizedDeviceName(trimmedDevice) {
            return normalized
        }

        return defaultValue(for: interfaceIdiom)
    }

    private static func normalizedDeviceName(_ deviceName: String) -> String? {
        guard !deviceName.isEmpty else { return nil }
        let lower = deviceName.lowercased()
        if lower.contains("iphone") || lower.contains("ipad") || lower.contains("ios") {
            return deviceName
        }
        return nil
    }
}
