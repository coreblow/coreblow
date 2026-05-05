import Foundation
import os

/// Errors specific to push relay communication.
enum PushRelayError: LocalizedError {
    case notConfigured
    case registrationFailed(String)
    case networkError(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Push relay not configured"
        case .registrationFailed(let msg): return "Registration failed: \(msg)"
        case .networkError(let msg): return "Network error: \(msg)"
        case .invalidResponse: return "Invalid relay response"
        }
    }
}

/// Client for communicating with the CoreBlow push relay server.
final class PushRelayClient {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "PushRelay")
    private let session: URLSession
    private let buildConfig: PushBuildConfig

    init(buildConfig: PushBuildConfig = .default, session: URLSession = .shared) {
        self.buildConfig = buildConfig
        self.session = session
    }

    /// Register this device with the push relay.
    func register(
        deviceTokenHex: String,
        gatewayID: String,
        deviceID: String
    ) async throws {
        guard let baseURL = buildConfig.relayBaseURL else {
            throw PushRelayError.notConfigured
        }

        guard let url = URL(string: "\(baseURL)/v1/register") else {
            throw PushRelayError.notConfigured
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "deviceToken": deviceTokenHex,
            "gatewayId": gatewayID,
            "deviceId": deviceID,
            "platform": "ios",
            "environment": buildConfig.apnsEnvironment.rawValue,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw PushRelayError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
            throw PushRelayError.registrationFailed(message)
        }

        logger.info("Relay registration successful for gateway \(gatewayID)")
    }

    /// Unregister from push relay.
    func unregister(deviceID: String) async throws {
        guard let baseURL = buildConfig.relayBaseURL,
              let url = URL(string: "\(baseURL)/v1/unregister") else {
            throw PushRelayError.notConfigured
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["deviceId": deviceID])

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw PushRelayError.invalidResponse
        }
        logger.info("Relay unregistration complete")
    }
}
