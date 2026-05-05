import Observation
import SwiftUI

@MainActor @Observable
final class AppState {
    var isGatewayConnected = false
    var gatewayVersion: String?
    var serverName: String?
    var remoteAddress: String?
    var isReconnecting = false
    var lastError: String?
    var activeSessions: [SessionData] = []
    var pendingApprovals: Int = 0
    var nodeCount: Int = 0
    static let shared = AppState()
    private init() {}
}
