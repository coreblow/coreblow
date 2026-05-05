import Foundation
extension AnyCodable { var stringValue: String? { value as? String }; var intValue: Int? { value as? Int }; var boolValue: Bool? { value as? Bool }; var dictValue: [String: AnyCodable]? { value as? [String: AnyCodable] } }
