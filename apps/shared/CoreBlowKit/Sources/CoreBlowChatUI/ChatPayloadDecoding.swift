import Foundation
import CoreBlowKit

/// CoreBlow: Utility for decoding typed payloads from AnyCodable gateway responses.
///
/// Re-encodes the AnyCodable to JSON Data, then decodes to the target type.
/// This avoids manual dictionary traversal and gives compile-time type safety.
public enum CoreBlowChatPayloadDecoding {
    public static func decode<T: Decodable>(_ payload: AnyCodable, as _: T.Type = T.self) throws -> T {
        let data = try JSONEncoder().encode(payload)
        return try JSONDecoder().decode(T.self, from: data)
    }
}

/// OC-compatible alias used in ChatUI type-alias file.
typealias ChatPayloadDecoding = CoreBlowChatPayloadDecoding
