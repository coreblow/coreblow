import Foundation

/// CoreBlow: Original implementation of Gateway Payload Decoding.
/// 1. Pattern borrowed: Generics-based decoding helpers for JSON/Any payloads.
/// 2. Implemented differently: Struct-based abstractions using Swift's `JSONDecoder` correctly injected, strongly-typed `DecodingError` propagation, and avoidance of global enums.

public struct CoreBlowPayloadDecoder {

    private static let standardDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    public enum PayloadError: Error {
        case missingPayload
        case invalidFormat
        case decodingFailed(underlying: Error)
    }

    /// Strictly decodes a payload, throwing if it fails or is absent.
    public static func decodeStrict<T: Decodable>(_ type: T.Type, from rawPayload: Any?) throws -> T {
        guard let payload = rawPayload else {
            throw PayloadError.missingPayload
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            return try standardDecoder.decode(T.self, from: data)
        } catch let error as DecodingError {
            throw PayloadError.decodingFailed(underlying: error)
        } catch {
            throw PayloadError.invalidFormat
        }
    }

    /// Safely decodes a payload, returning nil if absent but throwing on format errors.
    public static func decodeOptional<T: Decodable>(_ type: T.Type, from rawPayload: Any?) throws -> T? {
        guard rawPayload != nil else { return nil }
        return try decodeStrict(type, from: rawPayload)
    }
}
