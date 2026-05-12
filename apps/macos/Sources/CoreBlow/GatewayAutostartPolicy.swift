import Foundation
import OSLog
import CoreBlowKit
import OSLog

@MainActor
enum GatewayAutostartPolicy {
    static func shouldAutoStart(config: ConfigStore) -> Bool {
        config.autoStart && !config.gatewayHost.isEmpty
    }

    static func shouldAutoStart(state: AppState) -> Bool {
        state.connectionMode != .unconfigured
    }
}
