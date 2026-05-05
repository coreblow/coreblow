import Foundation
enum JSONObjectExtractionSupport { static func extract<T: Decodable>(_ type: T.Type, from json: String) -> T? { guard let d = json.data(using: .utf8) else { return nil }; return try? JSONDecoder().decode(T.self, from: d) } }
