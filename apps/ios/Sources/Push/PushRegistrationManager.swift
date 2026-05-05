import Foundation
import os

/// Manages APNs device token registration and gateway synchronization.
final class PushRegistrationManager {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "PushRegistration")
    private var lastRegisteredTokenHex: String?
    private var pendingTokenHex: String?

    /// Store the device token received from UIApplicationDelegate.
    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        logger.info("APNs token received: \(hex.prefix(12))…")
        pendingTokenHex = hex
    }

    /// Sync the stored token to the gateway if not already registered.
    func syncTokenToGateway(
        connection: GatewayConnectionController,
        buildConfig: PushBuildConfig = .default
    ) async {
        guard let hex = pendingTokenHex, hex != lastRegisteredTokenHex else { return }
        guard buildConfig.isEnabled else { return }

        do {
            let params: [String: Any] = [
                "token": hex,
                "platform": "ios",
                "environment": buildConfig.apnsEnvironment.rawValue,
                "transport": buildConfig.transportMode.rawValue,
            ]
            _ = try await connection.sendInvoke(command: "push.register", params: params)
            lastRegisteredTokenHex = hex
            logger.info("Push token registered with gateway")
        } catch {
            logger.error("Push token registration failed: \(error.localizedDescription)")
        }
    }

    /// Reset registration state (e.g. on disconnect).
    func reset() {
        lastRegisteredTokenHex = nil
    }
}
