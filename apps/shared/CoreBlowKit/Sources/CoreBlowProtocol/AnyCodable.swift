import Foundation

/// Type-erased Codable container for heterogeneous JSON payloads.
public struct AnyCodable: Codable, @unchecked Sendable, Hashable, CustomStringConvertible {
    public let value: Any
    public init(_ value: Any) { self.value = value }
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { value = NSNull() }
        else if let b = try? c.decode(Bool.self) { value = b }
        else if let i = try? c.decode(Int.self) { value = i }
        else if let d = try? c.decode(Double.self) { value = d }
        else if let s = try? c.decode(String.self) { value = s }
        else if let a = try? c.decode([AnyCodable].self) { value = a }
        else if let o = try? c.decode([String: AnyCodable].self) { value = o }
        else { throw DecodingError.dataCorruptedError(in: c, debugDescription: "unsupported AnyCodable type") }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case is NSNull: try c.encodeNil()
        case let b as Bool: try c.encode(b)
        case let i as Int: try c.encode(i)
        case let d as Double: try c.encode(d)
        case let s as String: try c.encode(s)
        case let a as [AnyCodable]: try c.encode(a)
        case let o as [String: AnyCodable]: try c.encode(o)
        default: try c.encodeNil()
        }
    }
    public static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool { lhs.description == rhs.description }
    public func hash(into hasher: inout Hasher) { hasher.combine(description) } // codespell:ignore inout
    public var description: String { String(describing: value) }
}
