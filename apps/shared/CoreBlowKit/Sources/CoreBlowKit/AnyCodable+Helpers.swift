import Foundation; import CoreBlowProtocol
extension AnyCodable {
    public var stringValue: String? { value as? String }; public var intValue: Int? { value as? Int }
    public var doubleValue: Double? { value as? Double }; public var boolValue: Bool? { value as? Bool }
    public var arrayValue: [AnyCodable]? { value as? [AnyCodable] }
    public var dictValue: [String: AnyCodable]? { value as? [String: AnyCodable] }
    public subscript(key: String) -> AnyCodable? { dictValue?[key] }
}
