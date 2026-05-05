import Foundation

/// Routes invoke requests to the appropriate capability handler.
@MainActor
final class NodeCapabilityRouter {

    enum RouterError: Error {
        case unknownCommand
        case handlerUnavailable
    }

    typealias Handler = (BridgeInvokeRequest) async throws -> BridgeInvokeResponse

    private let handlers: [String: Handler]

    init(handlers: [String: Handler]) {
        self.handlers = handlers
    }

    func handle(_ request: BridgeInvokeRequest) async throws -> BridgeInvokeResponse {
        guard let handler = handlers[request.command] else {
            throw RouterError.unknownCommand
        }
        return try await handler(request)
    }
}

/// Gateway invoke request.
struct BridgeInvokeRequest {
    let id: String
    let command: String
    let paramsJSON: String?
}

/// Gateway invoke response.
struct BridgeInvokeResponse {
    let id: String
    let ok: Bool
    let resultJSON: String?
    let error: CoreBlowNodeError?

    init(id: String, ok: Bool, resultJSON: String? = nil, error: CoreBlowNodeError? = nil) {
        self.id = id
        self.ok = ok
        self.resultJSON = resultJSON
        self.error = error
    }
}

/// Typed node error codes.
struct CoreBlowNodeError {
    let code: Code
    let message: String

    enum Code: String {
        case invalidRequest = "invalid-request"
        case unavailable = "unavailable"
        case backgroundUnavailable = "background-unavailable"
        case permissionDenied = "permission-denied"
        case timeout = "timeout"
    }
}
