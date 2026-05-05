import Foundation
import os.log

/// Persistent storage for gateway settings using UserDefaults.
final class GatewaySettingsStore: ObservableObject {

    private let defaults: UserDefaults
    private let logger = Logger(subsystem: "ai.coreblow.app", category: "GatewaySettings")

    private enum Keys {
        static let savedEndpoints = "gateway.savedEndpoints"
        static let lastConnectedID = "gateway.lastConnectedID"
        static let autoConnect = "gateway.autoConnect"
        static let tlsRequired = "gateway.tlsRequired"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Saved Endpoints

    var savedEndpoints: [GatewayConnectConfig] {
        get {
            guard let data = defaults.data(forKey: Keys.savedEndpoints) else { return [] }
            return (try? JSONDecoder().decode([GatewayConnectConfig].self, from: data)) ?? []
        }
        set {
            let data = try? JSONEncoder().encode(newValue)
            defaults.set(data, forKey: Keys.savedEndpoints)
            objectWillChange.send()
        }
    }

    func saveEndpoint(_ config: GatewayConnectConfig) {
        var endpoints = savedEndpoints
        endpoints.removeAll { $0.stableID == config.stableID }
        endpoints.insert(config, at: 0)
        savedEndpoints = endpoints
        logger.info("Saved endpoint: \(config.label)")
    }

    func removeEndpoint(_ config: GatewayConnectConfig) {
        savedEndpoints.removeAll { $0.stableID == config.stableID }
        logger.info("Removed endpoint: \(config.label)")
    }

    // MARK: - Last Connected

    var lastConnectedID: String? {
        get { defaults.string(forKey: Keys.lastConnectedID) }
        set { defaults.set(newValue, forKey: Keys.lastConnectedID) }
    }

    // MARK: - Preferences

    var autoConnect: Bool {
        get { defaults.bool(forKey: Keys.autoConnect) }
        set { defaults.set(newValue, forKey: Keys.autoConnect); objectWillChange.send() }
    }

    var tlsRequired: Bool {
        get { defaults.bool(forKey: Keys.tlsRequired) }
        set { defaults.set(newValue, forKey: Keys.tlsRequired); objectWillChange.send() }
    }
}
