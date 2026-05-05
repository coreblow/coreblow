import Foundation
public enum ChatPayloadDecoding {
    public static func decodeStreamChunk(_ data: Data) -> String? { guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }; return json["content"] as? String ?? json["text"] as? String }
}
