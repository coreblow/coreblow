import Foundation
enum GatewayAutostartPolicy {
    static func shouldAutoStart(config: ConfigStore) -> Bool {
        config.autoStart && !config.gatewayHost.isEmpty
    }
}
