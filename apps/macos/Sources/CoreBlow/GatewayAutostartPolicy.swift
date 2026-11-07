import Foundation
import OSLog
import CoreBlowKit
import OSLog

@MainActor
enum GatewayAutostartPolicy {
    static func shouldStartGateway(mode: AppState.ConnectionMode, paused: Bool) -> Bool {
        mode == .local && !paused
    }

    static func shouldEnsureLaunchAgent(
        mode: AppState.ConnectionMode,
        paused: Bool) -> Bool
    {
        self.shouldStartGateway(mode: mode, paused: paused)
    }

    static func shouldAutoStart(state: AppState) -> Bool {
        state.connectionMode != .unconfigured
    }
}
