import Foundation
import CoreBlowProtocol

/// Re-export AnyCodable from CoreBlowProtocol so downstream modules
/// (CoreBlowChatUI, macOS targets) see it without importing CoreBlowProtocol directly.
public typealias AnyCodable = CoreBlowProtocol.AnyCodable

/// CoreBlow: Extended Codable wrapper with dynamic member lookup and flexible numeric bridging.
///
/// 1. Pattern borrowed: Wrapping arbitrary JSON payloads (dictionaries, arrays, primitives)
///    into a `Codable` struct to circumvent Swift's strict static typing where necessary.
/// 2. Implemented differently: `CoreBlowAnyCodable` explicitly avoids recursive dictionary
///    nesting panics and implements `Equatable` correctly across numeric bridging
///    (e.g. Double to Int matching). This prevents testing frameworks from failing when
///    JSON frameworks decode numbers arbitrarily.
@dynamicMemberLookup
public struct CoreBlowAnyCodable: Codable, @unchecked Sendable, CustomStringConvertible {

    public let value: Any

    public init(_ value: Any?) {
        self.value = value ?? NSNull()
    }

    // MARK: - Decoding

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([CoreBlowAnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: CoreBlowAnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "CoreBlowAnyCodable value cannot be decoded."
            )
        }
    }

    // MARK: - Encoding

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self.value {
        case is NSNull: try container.encodeNil()
        case let bool as Bool: try container.encode(bool)
        case let int as Int: try container.encode(int)
        case let double as Double: try container.encode(double)
        case let string as String: try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { CoreBlowAnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { CoreBlowAnyCodable($0) })
        default:
            throw EncodingError.invalidValue(
                self.value,
                EncodingError.Context(
                    codingPath: container.codingPath,
                    debugDescription: "CoreBlowAnyCodable value cannot be encoded."
                )
            )
        }
    }

    // MARK: - Dynamic Member Lookup

    public subscript(dynamicMember member: String) -> CoreBlowAnyCodable? {
        if let dict = value as? [String: Any] {
            return dict[member].map { CoreBlowAnyCodable($0) }
        }
        return nil
    }

    // MARK: - CustomStringConvertible

    public var description: String {
        return String(describing: value)
    }
}

// MARK: - Equatable Conformance

extension CoreBlowAnyCodable: Equatable {
    public static func == (lhs: CoreBlowAnyCodable, rhs: CoreBlowAnyCodable) -> Bool {
        switch (lhs.value, rhs.value) {
        case is (NSNull, NSNull): return true
        case let (l as Bool, r as Bool): return l == r
        case let (l as Int, r as Int): return l == r
        case let (l as Double, r as Double): return l == r
        case let (l as String, r as String): return l == r
        case let (l as [Any], r as [Any]):
            return l.map { CoreBlowAnyCodable($0) } == r.map { CoreBlowAnyCodable($0) }
        case let (l as [String: Any], r as [String: Any]):
            return l.mapValues { CoreBlowAnyCodable($0) } == r.mapValues { CoreBlowAnyCodable($0) }

        // Flexible Numeric Bridging (e.g. 5.0 == 5)
        case let (l as Int, r as Double): return Double(l) == r
        case let (l as Double, r as Int): return l == Double(r)

        default: return false
        }
    }
}
