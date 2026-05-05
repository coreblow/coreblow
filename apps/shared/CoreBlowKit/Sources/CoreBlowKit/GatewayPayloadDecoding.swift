import Foundation
public enum GatewayPayloadDecoding {
    public static func decode<T: Decodable>(_ type: T.Type, from params: AnyCodable?) throws -> T {
        guard let params else { throw DecodingError.valueNotFound(T.self, .init(codingPath: [], debugDescription: "nil params")) }
        let data = try JSONEncoder().encode(params); return try JSONDecoder().decode(T.self, from: data)
    }
}
