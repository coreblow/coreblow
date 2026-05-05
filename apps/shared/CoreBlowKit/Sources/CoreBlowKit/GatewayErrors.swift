import Foundation
public enum GatewayErrors {
    public struct ConnectionError: Error, LocalizedError { public let code: String; public let detail: String; public var errorDescription: String? { "[\(code)] \(detail)" } }
    public static func from(errorCode: ErrorCode, message: String) -> ConnectionError { ConnectionError(code: errorCode.rawValue, detail: message) }
}
