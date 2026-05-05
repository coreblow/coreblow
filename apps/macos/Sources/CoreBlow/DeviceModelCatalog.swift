import Foundation
enum DeviceModelCatalog { static func modelName(for identifier: String) -> String? { /* lookup from bundled JSON */ return nil }; static func isAppleSilicon(identifier: String) -> Bool { identifier.contains("arm64") || identifier.hasPrefix("Mac14") } }
