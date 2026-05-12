import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Foundation
import CoreBlowKit
import Observation
import SwiftUI

@MainActor @Observable
final class AppState {
    private let isPreview: Bool
    private var isInitializing = true
    private var isApplyingRemoteTokenConfig = false
    private var configWatcher: ConfigFileWatcher?
    private var suppressVoiceWakeGlobalSync = false
    private var voiceWakeGlobalSyncTask: Task<Void, Never>?

    private func ifNotPreview(_ action: () -> Void) {
        guard !isPreview else { return }
        action()
    }

    enum ConnectionMode: String {
        case unconfigured
        case local
        case remote
    }

    enum RemoteTransport: String {
        case ssh
        case direct
    }

    // MARK: - Gateway state

    var isGatewayConnected = false
    var gatewayVersion: String?
    var serverName: String?
    var remoteAddress: String?
    var isReconnecting = false
    var lastError: String?
    var activeSessions: [SessionData] = []
    var pendingApprovals: Int = 0
    var nodeCount: Int = 0

    // MARK: - Persisted preferences

    var isPaused: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(isPaused, forKey: pauseDefaultsKey) } }
    }

    var launchAtLogin: Bool {
        didSet {
            guard !isInitializing else { return }
            ifNotPreview { Task { AppStateStore.updateLaunchAtLogin(enabled: self.launchAtLogin) } }
        }
    }

    var onboardingSeen: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(onboardingSeen, forKey: onboardingSeenKey) } }
    }

    var debugPaneEnabled: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(debugPaneEnabled, forKey: debugPaneEnabledKey) } }
    }

    var swabbleEnabled: Bool {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(swabbleEnabled, forKey: voiceWakeEnabledKey)
                Task { await VoiceWakeRuntime.shared.refresh(state: self) }
            }
        }
    }

    var swabbleTriggerWords: [String] {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(swabbleTriggerWords, forKey: voiceWakeTriggerWordsKey)
                if swabbleEnabled {
                    Task { await VoiceWakeRuntime.shared.refresh(state: self) }
                }
                scheduleVoiceWakeGlobalSyncIfNeeded()
            }
        }
    }

    var voiceWakeTriggerChime: VoiceWakeChime {
        didSet { ifNotPreview { storeChime(voiceWakeTriggerChime, key: voiceWakeTriggerChimeKey) } }
    }

    var voiceWakeSendChime: VoiceWakeChime {
        didSet { ifNotPreview { storeChime(voiceWakeSendChime, key: voiceWakeSendChimeKey) } }
    }

    var iconAnimationsEnabled: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(iconAnimationsEnabled, forKey: iconAnimationsKey) } }
    }

    var showDockIcon: Bool {
        didSet {
            guard !isInitializing else { return }
            ifNotPreview {
                UserDefaults.standard.set(showDockIcon, forKey: showDockIconKey)
                AppActivationPolicy.apply(showDockIcon: showDockIcon)
            }
        }
    }

    var voiceWakeMicID: String {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(voiceWakeMicID, forKey: voiceWakeMicIDKey)
                if swabbleEnabled {
                    Task { await VoiceWakeRuntime.shared.refresh(state: self) }
                }
            }
        }
    }

    var voiceWakeMicName: String {
        didSet { ifNotPreview { UserDefaults.standard.set(voiceWakeMicName, forKey: voiceWakeMicNameKey) } }
    }

    var voiceWakeLocaleID: String {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(voiceWakeLocaleID, forKey: voiceWakeLocaleIDKey)
                if swabbleEnabled {
                    Task { await VoiceWakeRuntime.shared.refresh(state: self) }
                }
            }
        }
    }

    var voiceWakeAdditionalLocaleIDs: [String] {
        didSet { ifNotPreview { UserDefaults.standard.set(voiceWakeAdditionalLocaleIDs, forKey: voiceWakeAdditionalLocalesKey) } }
    }

    var voicePushToTalkEnabled: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(voicePushToTalkEnabled, forKey: voicePushToTalkKey) } }
    }

    var talkEnabled: Bool {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(talkEnabled, forKey: talkEnabledKey)
                Task { await self.setTalkEnabled(self.talkEnabled) }
            }
        }
    }

    var seamColorHex: String? = nil

    var iconOverride: String? = nil

    // MARK: - Transient state

    var isWorking = false
    var earBoostActive = false
    var blinkTick: Int = 0
    var sendCelebrationTick: Int = 0

    var heartbeatsEnabled: Bool {
        didSet {
            ifNotPreview {
                UserDefaults.standard.set(heartbeatsEnabled, forKey: heartbeatsEnabledKey)
                Task { _ = await GatewayConnection.shared.setHeartbeatsEnabled(self.heartbeatsEnabled) }
            }
        }
    }

    var connectionMode: ConnectionMode = .unconfigured {
        didSet {
            ifNotPreview { UserDefaults.standard.set(connectionMode.rawValue, forKey: connectionModeKey) }
            syncGatewayConfigIfNeeded()
        }
    }

    var remoteTransport: RemoteTransport = .direct {
        didSet { syncGatewayConfigIfNeeded() }
    }

    var canvasEnabled: Bool {
        didSet { ifNotPreview { UserDefaults.standard.set(canvasEnabled, forKey: canvasEnabledKey) } }
    }

    var execApprovalMode: ExecApprovalQuickMode {
        didSet {
            ifNotPreview {
                ExecApprovalsStore.updateDefaults { defaults in
                    defaults.security = self.execApprovalMode.security
                    defaults.ask = self.execApprovalMode.ask
                }
            }
        }
    }

    var canvasPanelVisible: Bool = false

    var peekabooBridgeEnabled = false

    // MARK: - Remote connection

    var remoteTarget: String = "" {
        didSet {
            ifNotPreview { UserDefaults.standard.set(remoteTarget, forKey: remoteTargetKey) }
            syncGatewayConfigIfNeeded()
        }
    }

    var remoteUrl: String = "" {
        didSet { syncGatewayConfigIfNeeded() }
    }

    var remoteToken: String = "" {
        didSet {
            guard !isApplyingRemoteTokenConfig else { return }
            remoteTokenDirty = true
            remoteTokenUnsupported = false
            syncGatewayConfigIfNeeded()
        }
    }

    private(set) var remoteTokenDirty = false
    private(set) var remoteTokenUnsupported = false

    var remoteIdentity: String = "" {
        didSet { ifNotPreview { UserDefaults.standard.set(remoteIdentity, forKey: remoteIdentityKey) } }
    }

    var remoteProjectRoot: String = "" {
        didSet { ifNotPreview { UserDefaults.standard.set(remoteProjectRoot, forKey: remoteProjectRootKey) } }
    }

    var remoteCliPath: String = "" {
        didSet { ifNotPreview { UserDefaults.standard.set(remoteCliPath, forKey: remoteCliPathKey) } }
    }

    private var earBoostTask: Task<Void, Never>?

    // MARK: - Lifecycle

    static let shared = AppState()

    private convenience init() {
        self.init(isPreview: false)
    }

    init(isPreview: Bool) {
        self.isPreview = isPreview
        let ud = UserDefaults.standard

        self.isPaused = ud.bool(forKey: pauseDefaultsKey)
        self.launchAtLogin = false
        self.onboardingSeen = ud.bool(forKey: onboardingSeenKey)
        self.debugPaneEnabled = ud.bool(forKey: debugPaneEnabledKey)

        let savedVoiceWake = ud.bool(forKey: voiceWakeEnabledKey)
        self.swabbleEnabled = voiceWakeSupported ? savedVoiceWake : false
        self.swabbleTriggerWords = (ud.array(forKey: voiceWakeTriggerWordsKey) as? [String]) ?? defaultVoiceWakeTriggers
        self.voiceWakeTriggerChime = Self.loadChime(key: voiceWakeTriggerChimeKey, fallback: .default)
        self.voiceWakeSendChime = Self.loadChime(key: voiceWakeSendChimeKey, fallback: .default)
        self.iconAnimationsEnabled = ud.object(forKey: iconAnimationsKey) as? Bool ?? true
        self.showDockIcon = ud.bool(forKey: showDockIconKey)
        self.voiceWakeMicID = ud.string(forKey: voiceWakeMicIDKey) ?? ""
        self.voiceWakeMicName = ud.string(forKey: voiceWakeMicNameKey) ?? ""
        self.voiceWakeLocaleID = ud.string(forKey: voiceWakeLocaleIDKey) ?? Locale.current.identifier
        self.voiceWakeAdditionalLocaleIDs = ud.stringArray(forKey: voiceWakeAdditionalLocalesKey) ?? []
        self.voicePushToTalkEnabled = ud.bool(forKey: voicePushToTalkKey)
        self.talkEnabled = ud.bool(forKey: talkEnabledKey)
        self.heartbeatsEnabled = ud.object(forKey: heartbeatsEnabledKey) as? Bool ?? true
        self.canvasEnabled = ud.object(forKey: canvasEnabledKey) as? Bool ?? true

        // Resolve exec approval mode from stored defaults
        let execDefaults = ExecApprovalsStore.resolveDefaults()
        self.execApprovalMode = ExecApprovalQuickMode.from(security: execDefaults.security, ask: execDefaults.ask)

        // Load connection mode from persistent storage
        if let modeRaw = ud.string(forKey: connectionModeKey),
           let mode = ConnectionMode(rawValue: modeRaw) {
            self.connectionMode = mode
        }
        if let transportRaw = ud.string(forKey: remoteTransportKey),
           let transport = RemoteTransport(rawValue: transportRaw) {
            self.remoteTransport = transport
        }
        self.remoteTarget = ud.string(forKey: remoteTargetKey) ?? ""
        self.remoteUrl = ud.string(forKey: remoteUrlKey) ?? ""
        self.remoteToken = ud.string(forKey: remoteTokenKey) ?? ""
        self.remoteIdentity = ud.string(forKey: remoteIdentityKey) ?? ""
        self.remoteProjectRoot = ud.string(forKey: remoteProjectRootKey) ?? ""
        self.remoteCliPath = ud.string(forKey: remoteCliPathKey) ?? ""

        // Permission checks
        if swabbleEnabled, !PermissionManager.voiceWakePermissionsGranted() {
            self.swabbleEnabled = false
        }
        if talkEnabled, !PermissionManager.voiceWakePermissionsGranted() {
            self.talkEnabled = false
        }

        // Start runtimes
        if !isPreview {
            Task { await VoiceWakeRuntime.shared.refresh(state: self) }
            Task { await TalkModeRuntime.shared.start() }
        }

        self.isInitializing = false

        if !isPreview {
            startConfigWatcher()
        }
    }

    // MARK: - Preview support

    init(preview: Bool) {
        self.isPreview = preview
        self.isPaused = false
        self.launchAtLogin = false
        self.onboardingSeen = true
        self.debugPaneEnabled = false
        self.swabbleEnabled = false
        self.swabbleTriggerWords = defaultVoiceWakeTriggers
        self.voiceWakeTriggerChime = .default
        self.voiceWakeSendChime = .default
        self.iconAnimationsEnabled = true
        self.showDockIcon = false
        self.voiceWakeMicID = ""
        self.voiceWakeMicName = ""
        self.voiceWakeLocaleID = Locale.current.identifier
        self.voiceWakeAdditionalLocaleIDs = []
        self.voicePushToTalkEnabled = false
        self.talkEnabled = false
        self.heartbeatsEnabled = true
        self.canvasEnabled = true
        self.execApprovalMode = .ask
        self.isInitializing = false
    }

    static var preview: AppState { AppState(preview: true) }

    // MARK: - Talk Mode

    func setTalkEnabled(_ enabled: Bool) async {
        talkEnabled = enabled
        if enabled {
            await TalkModeRuntime.shared.start()
        } else {
            await TalkModeRuntime.shared.stop()
        }
    }

    // MARK: - Voice Wake

    func setVoiceWakeEnabled(_ enabled: Bool) async {
        guard voiceWakeSupported else {
            swabbleEnabled = false
            return
        }

        swabbleEnabled = enabled
        guard !isPreview else { return }

        if !enabled {
            Task { await VoiceWakeRuntime.shared.refresh(state: self) }
            return
        }

        if PermissionManager.voiceWakePermissionsGranted() {
            Task { await VoiceWakeRuntime.shared.refresh(state: self) }
            return
        }

        // Request permissions interactively — for now use static check
        let granted = PermissionManager.voiceWakePermissionsGranted()
        swabbleEnabled = granted
        Task { await VoiceWakeRuntime.shared.refresh(state: self) }
    }

    /// Simple synchronous setter for Binding compatibility.
    func setSwabbleEnabled(_ enabled: Bool) {
        guard voiceWakeSupported else { return }
        swabbleEnabled = enabled
    }

    // MARK: - Global Wake Word Sync

    func applyGlobalVoiceWakeTriggers(_ triggers: [String]) {
        suppressVoiceWakeGlobalSync = true
        swabbleTriggerWords = triggers
        suppressVoiceWakeGlobalSync = false
    }

    private func scheduleVoiceWakeGlobalSyncIfNeeded() {
        guard !suppressVoiceWakeGlobalSync else { return }
        let sanitized = sanitizeVoiceWakeTriggers(swabbleTriggerWords)
        voiceWakeGlobalSyncTask?.cancel()
        voiceWakeGlobalSyncTask = Task { [sanitized] in
            try? await Task.sleep(nanoseconds: 650_000_000) // debounce
            await GatewayConnection.shared.voiceWakeSetTriggers(sanitized)
        }
    }

    // MARK: - Connection Mode

    func applyConnectionMode(_ mode: ConnectionMode) {
        connectionMode = mode
    }

    func applyRemoteTransport(_ transport: RemoteTransport) {
        remoteTransport = transport
    }

    // MARK: - Gateway State Mutations

    func applyGatewaySnapshot(connected: Bool, version: String?, serverName: String?, sessions: [SessionData]) {
        isGatewayConnected = connected
        gatewayVersion = version
        self.serverName = serverName
        activeSessions = sessions
    }

    func markReconnecting() {
        isReconnecting = true
        isGatewayConnected = false
    }

    func markConnected(version: String?) {
        isReconnecting = false
        isGatewayConnected = true
        gatewayVersion = version
        lastError = nil
    }

    func markDisconnected(error: String?) {
        isGatewayConnected = false
        isReconnecting = false
        lastError = error
    }

    func setWorking(_ working: Bool) {
        isWorking = working
    }

    func blinkOnce() {
        blinkTick &+= 1
    }

    func celebrateSend() {
        sendCelebrationTick &+= 1
    }

    // MARK: - Voice Ears

    func triggerVoiceEars(ttl: TimeInterval? = 5) {
        earBoostTask?.cancel()
        earBoostActive = true

        guard let ttl else { return }

        earBoostTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(ttl * 1_000_000_000))
            self?.earBoostActive = false
        }
    }

    func stopVoiceEars() {
        earBoostTask?.cancel()
        earBoostTask = nil
        earBoostActive = false
    }

    // MARK: - Stop

    func stop() {
        isGatewayConnected = false
        isReconnecting = false
        activeSessions = []
        stopVoiceEars()
        configWatcher = nil
    }

    // MARK: - Config File Watcher

    private func startConfigWatcher() {
        let configUrl = CoreBlowPaths.configFile
        configWatcher = ConfigFileWatcher(url: configUrl) { [weak self] in
            Task { @MainActor in
                self?.applyConfigFromDisk()
            }
        }
        Task { await configWatcher?.start() }
    }

    private func applyConfigFromDisk() {
        let root = Self.loadConfigDict()
        applyConfigOverrides(root)
    }

    private func applyConfigOverrides(_ root: [String: Any]) {
        let gateway = root["gateway"] as? [String: Any]
        let modeRaw = (gateway?["mode"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

        let desiredMode: ConnectionMode? = switch modeRaw {
        case "local": .local
        case "remote": .remote
        case "unconfigured": .unconfigured
        default: nil
        }

        if let desiredMode, desiredMode != connectionMode {
            connectionMode = desiredMode
        }

        // Apply remote config overrides
        let remote = gateway?["remote"] as? [String: Any]
        if let remoteUrlOverride = remote?["url"] as? String {
            let trimmed = remoteUrlOverride.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, trimmed != remoteUrl {
                remoteUrl = trimmed
            }
        }

        let transportRaw = remote?["transport"] as? String
        if let transportRaw, let transport = RemoteTransport(rawValue: transportRaw), transport != remoteTransport {
            remoteTransport = transport
        }
    }

    // MARK: - Gateway Config Sync

    private func syncGatewayConfigIfNeeded() {
        guard !isPreview, !isInitializing else { return }
        Task { @MainActor in syncGatewayConfigNow() }
    }

    func syncGatewayConfigNow() {
        guard !isPreview, !isInitializing else { return }

        var root = Self.loadConfigDict()
        var gateway = root["gateway"] as? [String: Any] ?? [:]
        var changed = false

        // Sync mode
        let currentMode = (gateway["mode"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let desiredMode: String? = switch connectionMode {
        case .local: "local"
        case .remote: "remote"
        case .unconfigured: nil
        }

        if let desiredMode {
            if currentMode != desiredMode {
                gateway["mode"] = desiredMode
                changed = true
            }
        } else if currentMode != nil {
            gateway.removeValue(forKey: "mode")
            changed = true
        }

        // Sync remote config
        if connectionMode == .remote {
            var remote = gateway["remote"] as? [String: Any] ?? [:]

            let trimmedUrl = remoteUrl.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedUrl.isEmpty {
                if (remote["url"] as? String) != trimmedUrl {
                    remote["url"] = trimmedUrl
                    changed = true
                }
            }

            if remoteTransport == .direct {
                if (remote["transport"] as? String) != "direct" {
                    remote["transport"] = "direct"
                    changed = true
                }
            } else {
                remote.removeValue(forKey: "transport")
                let sanitizedTarget = Self.sanitizeSSHTarget(remoteTarget)
                if !sanitizedTarget.isEmpty, (remote["sshTarget"] as? String) != sanitizedTarget {
                    remote["sshTarget"] = sanitizedTarget
                    changed = true
                }
                if !remoteIdentity.isEmpty, (remote["sshIdentity"] as? String) != remoteIdentity {
                    remote["sshIdentity"] = remoteIdentity
                    changed = true
                }
            }

            if remoteTokenDirty {
                let trimmedToken = remoteToken.trimmingCharacters(in: .whitespacesAndNewlines)
                if (remote["token"] as? String) != trimmedToken {
                    remote["token"] = trimmedToken.isEmpty ? nil : trimmedToken
                    changed = true
                }
            }

            if changed { gateway["remote"] = remote }
        }

        guard changed else { return }

        if gateway.isEmpty {
            root.removeValue(forKey: "gateway")
        } else {
            root["gateway"] = gateway
        }
        Self.saveConfigDict(root)
    }

    // MARK: - Helpers

    private static func sanitizeSSHTarget(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("ssh ") {
            return trimmed.replacingOccurrences(of: "ssh ", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return trimmed
    }

    private static func remoteHost(from urlString: String?) -> String? {
        guard let raw = urlString?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty, let url = URL(string: raw),
              let host = url.host?.trimmingCharacters(in: .whitespacesAndNewlines),
              !host.isEmpty
        else { return nil }
        return host
    }

    // MARK: - Chime Persistence

    private static func loadChime(key: String, fallback: VoiceWakeChime) -> VoiceWakeChime {
        guard let raw = UserDefaults.standard.string(forKey: key) else { return fallback }
        return VoiceWakeChime(rawValue: raw) ?? fallback
    }

    private func storeChime(_ chime: VoiceWakeChime, key: String) {
        UserDefaults.standard.set(chime.rawValue, forKey: key)
    }

    // MARK: - Remote Token State

    // MARK: - Config File I/O

    private static func loadConfigDict() -> [String: Any] {
        let url = CoreBlowPaths.configFile
        guard let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return json
    }

    private static func saveConfigDict(_ dict: [String: Any]) {
        let url = CoreBlowPaths.configFile
        do {
            let data = try JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys])
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
        } catch {
            // Config write is best-effort
        }
    }
}

// MARK: - Connection Mode Defaults Keys

let connectionModeKey = "CoreBlow_connectionMode"
private let remoteTransportKey = "CoreBlow_remoteTransport"
private let remoteTargetKey = "CoreBlow_remoteTarget"
private let remoteUrlKey = "CoreBlow_remoteUrl"
private let remoteTokenKey = "CoreBlow_remoteToken"
private let remoteIdentityKey = "CoreBlow_remoteIdentity"
private let remoteProjectRootKey = "CoreBlow_remoteProjectRoot"
private let remoteCliPathKey = "CoreBlow_remoteCliPath"
private let voiceWakeSendChimeKey = "CoreBlow_voiceWakeSendChime"
private let voiceWakeAdditionalLocalesKey = "CoreBlow_voiceWakeAdditionalLocales"

// MARK: - AppStateStore

@MainActor
enum AppStateStore {
    static let shared = AppState.shared

    static var isPausedFlag: Bool {
        UserDefaults.standard.bool(forKey: pauseDefaultsKey)
    }

    static func updateLaunchAtLogin(enabled: Bool) {
        // ServiceManagement integration deferred
        _ = enabled
    }

    static var canvasEnabled: Bool {
        UserDefaults.standard.object(forKey: canvasEnabledKey) as? Bool ?? true
    }

    static var connectionMode: AppState.ConnectionMode {
        shared.connectionMode
    }

    static var remoteTarget: String {
        shared.remoteTarget
    }

    static var remoteTransport: AppState.RemoteTransport {
        shared.remoteTransport
    }

    static var remoteUrl: String {
        shared.remoteUrl
    }

    static var remoteIdentity: String {
        shared.remoteIdentity
    }

    static func triggerVoiceEars(ttl: TimeInterval?) {
        shared.triggerVoiceEars(ttl: ttl)
    }

    static func stopVoiceEars() {
        shared.stopVoiceEars()
    }
}

// MARK: - Activation policy

@MainActor
enum AppActivationPolicy {
    static func apply(showDockIcon: Bool) {
        NSApp.setActivationPolicy(showDockIcon ? .regular : .accessory)
    }
}
