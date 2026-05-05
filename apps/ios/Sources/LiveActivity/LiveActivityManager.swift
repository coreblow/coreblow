import Foundation
import os
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Manages Live Activity lifecycle for persistent gateway status display.
@MainActor
final class LiveActivityManager {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "LiveActivity")
    #if canImport(ActivityKit)
    private var currentActivity: Activity<CoreBlowActivityAttributes>?
    #endif

    /// Start or update a Live Activity with current gateway status.
    func update(connected: Bool, serverName: String?) {
        #if canImport(ActivityKit)
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            logger.debug("Live Activities not enabled")
            return
        }

        let contentState = CoreBlowActivityAttributes.ContentState(
            isConnected: connected,
            serverName: serverName,
            lastUpdateMs: Int64(Date().timeIntervalSince1970 * 1000))

        if let existing = currentActivity {
            Task {
                await existing.update(
                    ActivityContent(state: contentState, staleDate: nil))
            }
        } else {
            let attributes = CoreBlowActivityAttributes(gatewayLabel: serverName ?? "CoreBlow Gateway")
            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: ActivityContent(state: contentState, staleDate: nil),
                    pushType: nil)
                currentActivity = activity
                logger.info("Live Activity started: \(activity.id)")
            } catch {
                logger.error("Failed to start Live Activity: \(error.localizedDescription)")
            }
        }
        #endif
    }

    /// End the current Live Activity.
    func end() {
        #if canImport(ActivityKit)
        guard let activity = currentActivity else { return }
        Task {
            let finalState = CoreBlowActivityAttributes.ContentState(
                isConnected: false,
                serverName: nil,
                lastUpdateMs: Int64(Date().timeIntervalSince1970 * 1000))
            await activity.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .immediate)
            currentActivity = nil
            logger.info("Live Activity ended")
        }
        #endif
    }
}
