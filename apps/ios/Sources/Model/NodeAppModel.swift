import Foundation
import os
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Central app model managing gateway connections, services, and node state.
@MainActor
@Observable
final class NodeAppModel {

    struct AgentDeepLinkPrompt: Identifiable, Equatable {
        let id: String
        let messagePreview: String
        let urlPreview: String
    }

    enum CameraHUDKind {
        case photo, recording, success, error
    }

    // MARK: - Published State

    var isBackgrounded: Bool = false
    var gatewayStatusText: String = "Offline"
    var nodeStatusText: String = "Offline"
    var operatorStatusText: String = "Offline"
    var gatewayServerName: String?
    var gatewayRemoteAddress: String?
    var connectedGatewayID: String?
    var gatewayAutoReconnectEnabled: Bool = true
    var gatewayPairingPaused: Bool = false
    var gatewayPairingRequestId: String?
    var seamColorHex: String?
    var selectedAgentId: String?
    var gatewayDefaultAgentId: String?
    var homeCanvasRevision: Int = 0
    var lastShareEventText: String = "No share events yet."
    var openChatRequestID: Int = 0
    var cameraHUDText: String?
    var cameraHUDKind: CameraHUDKind?
    var cameraFlashNonce: Int = 0
    var screenRecordActive: Bool = false
    var lastAutoA2uiURL: String?

    private(set) var pendingAgentDeepLinkPrompt: AgentDeepLinkPrompt?

    // MARK: - Private

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "NodeAppModel")
    private var mainSessionBaseKey: String = "main"
    private let gatewayConnection: GatewayConnectionController
    private let healthMonitor: GatewayHealthMonitor
    private let settingsStore: GatewaySettingsStore
    private let keychainStore: KeychainStore
    private let locationService: LocationService
    private let deviceStatusService: DeviceStatusService
    private let camera: CameraController
    @ObservationIgnored private lazy var capabilityRouter: NodeCapabilityRouter = buildCapabilityRouter()
    private let voiceWake: VoiceWakeManager
    private let talkMode: TalkModeManager
    @ObservationIgnored private let watchReplyCoordinator = WatchReplyCoordinator()

    private var gatewayConnected = false
    private var operatorConnected = false
    #if canImport(UIKit)
    private var backgroundGraceTaskID: UIBackgroundTaskIdentifier = .invalid
    #endif
    @ObservationIgnored private var backgroundGraceTaskTimer: Task<Void, Never>?
    private var backgroundReconnectSuppressed = false
    private var backgroundedAt: Date?
    private var reconnectAfterBackgroundArmed = false

    // MARK: - Init

    init(
        gatewayConnection: GatewayConnectionController? = nil,
        locationService: LocationService = LocationService(),
        deviceStatusService: DeviceStatusService = DeviceStatusService(),
        camera: CameraController = CameraController(),
        voiceWakePreferences: VoiceWakePreferences = VoiceWakePreferences(),
        talkMode: TalkModeManager = TalkModeManager()
    ) {
        let keychain = KeychainStore()
        let settings = GatewaySettingsStore()
        self.keychainStore = keychain
        self.settingsStore = settings
        self.gatewayConnection = gatewayConnection ?? GatewayConnectionController(settingsStore: settings, keychainStore: keychain)
        self.healthMonitor = GatewayHealthMonitor(controller: self.gatewayConnection)
        self.locationService = locationService
        self.deviceStatusService = deviceStatusService
        self.camera = camera
        self.voiceWake = VoiceWakeManager(preferences: voiceWakePreferences)
        self.talkMode = talkMode
    }

    // MARK: - Scene Phase

    func setScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background:
            isBackgrounded = true
            healthMonitor.stop()
            backgroundedAt = Date()
            reconnectAfterBackgroundArmed = true
            beginBackgroundGracePeriod()

        case .active, .inactive:
            isBackgrounded = false
            endBackgroundGracePeriod(reason: "scene_foreground")
            if operatorConnected { healthMonitor.start() }
            if phase == .active, reconnectAfterBackgroundArmed {
                reconnectAfterBackgroundArmed = false
                handleForegroundReconnect()
            }

        @unknown default:
            isBackgrounded = false
        }
    }

    // MARK: - Invoke Routing

    func handleInvoke(_ req: BridgeInvokeRequest) async -> BridgeInvokeResponse {
        if isBackgrounded, isBackgroundRestricted(req.command) {
            return BridgeInvokeResponse(
                id: req.id, ok: false,
                error: CoreBlowNodeError(code: .backgroundUnavailable,
                    message: "NODE_BACKGROUND_UNAVAILABLE: requires foreground"))
        }

        do {
            return try await capabilityRouter.handle(req)
        } catch let error as NodeCapabilityRouter.RouterError {
            switch error {
            case .unknownCommand:
                return BridgeInvokeResponse(
                    id: req.id, ok: false,
                    error: CoreBlowNodeError(code: .invalidRequest, message: "unknown command"))
            case .handlerUnavailable:
                return BridgeInvokeResponse(
                    id: req.id, ok: false,
                    error: CoreBlowNodeError(code: .unavailable, message: "handler unavailable"))
            }
        } catch {
            return BridgeInvokeResponse(
                id: req.id, ok: false,
                error: CoreBlowNodeError(code: .unavailable, message: error.localizedDescription))
        }
    }

    // MARK: - Private Helpers

    private func isBackgroundRestricted(_ command: String) -> Bool {
        command.hasPrefix("canvas.") || command.hasPrefix("camera.") ||
        command.hasPrefix("screen.") || command.hasPrefix("talk.")
    }

    private func buildCapabilityRouter() -> NodeCapabilityRouter {
        NodeCapabilityRouter(handlers: [:])
    }

    private func beginBackgroundGracePeriod(seconds: TimeInterval = 25) {
        #if canImport(UIKit)
        endBackgroundGracePeriod(reason: "restart")
        let taskID = UIApplication.shared.beginBackgroundTask(withName: "gateway-grace") { [weak self] in
            Task { @MainActor in
                self?.endBackgroundGracePeriod(reason: "expired")
            }
        }
        guard taskID != .invalid else { return }
        backgroundGraceTaskID = taskID
        backgroundGraceTaskTimer = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(max(1, seconds) * 1_000_000_000))
            await MainActor.run { self?.endBackgroundGracePeriod(reason: "timer") }
        }
        #endif
    }

    private func endBackgroundGracePeriod(reason: String) {
        backgroundGraceTaskTimer?.cancel()
        backgroundGraceTaskTimer = nil
        #if canImport(UIKit)
        guard backgroundGraceTaskID != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundGraceTaskID)
        backgroundGraceTaskID = .invalid
        #endif
        logger.info("Background grace ended: \(reason)")
    }

    private func handleForegroundReconnect() {
        let elapsed = backgroundedAt.map { Date().timeIntervalSince($0) } ?? 0
        backgroundedAt = nil
        guard elapsed >= 3.0 else { return }
        gatewayStatusText = "Reconnecting…"
        if let config = gatewayConnection.activeConfig {
            gatewayConnection.disconnect()
            gatewayConnection.connect(to: config)
        }
    }
}
