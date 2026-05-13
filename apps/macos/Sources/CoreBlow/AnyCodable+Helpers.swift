import Foundation
import CoreBlowKit
import CoreBlowProtocol

/// Convenience accessors for `AnyCodable` values in gateway payloads.
extension AnyCodable {
    var stringValue: String? { value as? String }
    var intValue: Int? { value as? Int }
    var boolValue: Bool? { value as? Bool }
    var doubleValue: Double? { value as? Double }
    var dictValue: [String: AnyCodable]? { value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { value as? [AnyCodable] }
}
