// CoreBlowProtocol/FlexValue.swift
// CoreBlow's type-erased JSON wrapper — original implementation.
//
// Key differences original implementation.
//   - Uses enum-backed storage instead of `Any` (type-safe at rest)
//   - @dynamicMemberLookup for clean dict access: value.userId
//   - ExpressibleByXxxLiteral conformances for ergonomic construction
//   - Proper Sendable without @unchecked (no reference types in storage)

import Foundation

/// Type-erased JSON value that round-trips through Codable.
///
/// Backed by an enum (not `Any`) so the compiler can prove `Sendable`
/// conformance without `@unchecked`.
@dynamicMemberLookup
public enum FlexValue: Sendable, Hashable, Codable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([FlexValue])
    case object([String: FlexValue])

    // MARK: - Dynamic Member Lookup

    /// Subscript into `.object` values by key name: `flex.userId`
    public subscript(dynamicMember key: String) -> FlexValue? {
        guard case .object(let dict) = self else { return nil }
        return dict[key]
    }

    /// Subscript by string key (for computed keys).
    public subscript(key: String) -> FlexValue? {
        guard case .object(let dict) = self else { return nil }
        return dict[key]
    }

    /// Subscript by integer index into arrays.
    public subscript(index: Int) -> FlexValue? {
        guard case .array(let arr) = self, arr.indices.contains(index) else { return nil }
        return arr[index]
    }

    // MARK: - Value Extraction

    /// Attempt to extract the underlying `Any` value for bridging.
    public var rawValue: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let v): return v
        case .int(let v): return v
        case .double(let v): return v
        case .string(let v): return v
        case .array(let a): return a.map(\.rawValue)
        case .object(let d): return d.mapValues(\.rawValue)
        }
    }

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var intValue: Int? {
        switch self {
        case .int(let i): return i
        case .double(let d): return Int(exactly: d)
        default: return nil
        }
    }

    public var doubleValue: Double? {
        switch self {
        case .double(let d): return d
        case .int(let i): return Double(i)
        default: return nil
        }
    }

    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    public var arrayValue: [FlexValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    public var objectValue: [String: FlexValue]? {
        if case .object(let d) = self { return d }
        return nil
    }

    public var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    // MARK: - Construction from Any

    /// Convert an arbitrary `Any` into a `FlexValue`, normalizing types.
    public static func from(_ value: Any) -> FlexValue {
        // NSNumber bool detection (must come before Int/Double)
        if let number = value as? NSNumber,
           CFGetTypeID(number) == CFBooleanGetTypeID() {
            return .bool(number.boolValue)
        }
        switch value {
        case let b as Bool: return .bool(b)
        case let i as Int: return .int(i)
        case let d as Double: return .double(d)
        case let s as String: return .string(s)
        case is NSNull: return .null
        case let flex as FlexValue: return flex
        case let arr as [Any]: return .array(arr.map { from($0) })
        case let dict as [String: Any]: return .object(dict.mapValues { from($0) })
        case let arr as [FlexValue]: return .array(arr)
        case let dict as [String: FlexValue]: return .object(dict)
        default: return .null
        }
    }

    /// Bridge from AnyCodable to FlexValue.
    public static func from(anyCodable: AnyCodable) -> FlexValue {
        return from(anyCodable.value)
    }

    // MARK: - Codable

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
            return
        }
        // Bool must precede Int/Double because JSONDecoder decodes
        // true/false as 1/0 when trying numeric types first.
        if let b = try? container.decode(Bool.self) {
            self = .bool(b)
            return
        }
        if let i = try? container.decode(Int.self) {
            self = .int(i)
            return
        }
        if let d = try? container.decode(Double.self) {
            self = .double(d)
            return
        }
        if let s = try? container.decode(String.self) {
            self = .string(s)
            return
        }
        if let dict = try? container.decode([String: FlexValue].self) {
            self = .object(dict)
            return
        }
        if let arr = try? container.decode([FlexValue].self) {
            self = .array(arr)
            return
        }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "FlexValue: unsupported JSON type")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let v): try container.encode(v)
        case .int(let v): try container.encode(v)
        case .double(let v): try container.encode(v)
        case .string(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .object(let v): try container.encode(v)
        }
    }
}

// MARK: - Literal Conformances

extension FlexValue: ExpressibleByNilLiteral {
    public init(nilLiteral: ()) { self = .null }
}

extension FlexValue: ExpressibleByBooleanLiteral {
    public init(booleanLiteral value: Bool) { self = .bool(value) }
}

extension FlexValue: ExpressibleByIntegerLiteral {
    public init(integerLiteral value: Int) { self = .int(value) }
}

extension FlexValue: ExpressibleByFloatLiteral {
    public init(floatLiteral value: Double) { self = .double(value) }
}

extension FlexValue: ExpressibleByStringLiteral {
    public init(stringLiteral value: String) { self = .string(value) }
}

extension FlexValue: ExpressibleByArrayLiteral {
    public init(arrayLiteral elements: FlexValue...) { self = .array(elements) }
}

extension FlexValue: ExpressibleByDictionaryLiteral {
    public init(dictionaryLiteral elements: (String, FlexValue)...) {
        self = .object(Dictionary(uniqueKeysWithValues: elements))
    }
}

// MARK: - CustomStringConvertible

extension FlexValue: CustomStringConvertible {
    public var description: String {
        switch self {
        case .null: return "null"
        case .bool(let v): return v ? "true" : "false"
        case .int(let v): return String(v)
        case .double(let v): return String(v)
        case .string(let v): return "\"\(v)\""
        case .array(let a): return "[\(a.map(\.description).joined(separator: ", "))]"
        case .object(let d):
            let pairs = d.sorted(by: { $0.key < $1.key })
                .map { "\"\($0.key)\": \($0.value)" }
            return "{\(pairs.joined(separator: ", "))}"
        }
    }
}
