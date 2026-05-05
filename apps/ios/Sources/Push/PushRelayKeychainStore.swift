import Foundation

/// Persistent storage for push relay registration credentials.
enum PushRelayRegistrationStore {

    private static let deviceIDKey = "pushRelay.deviceId"
    private static let registeredGatewayKey = "pushRelay.registeredGatewayId"
    private static let registeredTokenKey = "pushRelay.registeredTokenHex"

    static var deviceID: String {
        if let existing = UserDefaults.standard.string(forKey: deviceIDKey), !existing.isEmpty {
            return existing
        }
        let generated = UUID().uuidString.lowercased()
        UserDefaults.standard.set(generated, forKey: deviceIDKey)
        return generated
    }

    static var registeredGatewayID: String? {
        get { UserDefaults.standard.string(forKey: registeredGatewayKey) }
        set { UserDefaults.standard.set(newValue, forKey: registeredGatewayKey) }
    }

    static var registeredTokenHex: String? {
        get { UserDefaults.standard.string(forKey: registeredTokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: registeredTokenKey) }
    }

    static func clearRegistration() {
        registeredGatewayID = nil
        registeredTokenHex = nil
    }

    static func isRegistered(forGateway gatewayID: String, token: String) -> Bool {
        registeredGatewayID == gatewayID && registeredTokenHex == token
    }
}
