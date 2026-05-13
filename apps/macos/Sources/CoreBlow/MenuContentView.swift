import AppKit
import OSLog
import CoreBlowKit
import OSLog
import AVFoundation
import CoreBlowKit
import Foundation
import CoreBlowProtocol
import Observation
import SwiftUI

/// Menu contents for the CoreBlow menu bar extra.
struct MenuContentView: View {
    @State private var appState = AppState.shared
    @Environment(\.openSettings) private var openSettings
    @State private var availableMics: [AudioInputDevice] = []
    @State private var loadingMics = false
    @State private var micObserver = AudioInputDeviceObserver()
    @State private var pairingPrompter = NodePairingApprovalPrompter.shared
    @State private var devicePairingPrompter = DevicePairingApprovalPrompter.shared
    @State private var micRefreshTask: Task<Void, Never>?
    @State private var browserControlEnabled = true
    @AppStorage("coreblow.camera.enabled") private var cameraEnabled: Bool = false
    @AppStorage("coreblow.log.level") private var appLogLevelRaw: String = "default"
    @AppStorage("coreblow.log.fileEnabled") private var appFileLoggingEnabled: Bool = false

    // MARK: - Exec Approval Mode Binding

    private var execApprovalModeBinding: Binding<ExecApprovalQuickMode> {
        Binding(
            get: { appState.execApprovalMode },
            set: { appState.execApprovalMode = $0 })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(isOn: activeBinding) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(connectionLabel)
                    statusLine(
                        label: healthStatusLabel,
                        color: healthStatusColor)
                    if pairingPrompter.pendingCount > 0 {
                        statusLine(
                            label: "Pairing approval pending (\(pairingPrompter.pendingCount))",
                            color: .orange)
                    }
                    if devicePairingPrompter.pendingCount > 0 {
                        statusLine(
                            label: "Device pairing pending (\(devicePairingPrompter.pendingCount))",
                            color: .orange)
                    }
                }
            }
            .disabled(appState.connectionMode == .unconfigured)

            Divider()

            Toggle(isOn: heartbeatsBinding) {
                HStack(spacing: 8) {
                    Label("Send Heartbeats", systemImage: "waveform.path.ecg")
                    Spacer(minLength: 0)
                    statusLine(label: heartbeatStatusLabel, color: heartbeatStatusColor)
                }
            }

            Toggle(
                isOn: Binding(
                    get: { browserControlEnabled },
                    set: { enabled in
                        browserControlEnabled = enabled
                        Task { await saveBrowserControlEnabled(enabled) }
                    })) {
                Label("Browser Control", systemImage: "globe")
            }

            Toggle(isOn: $cameraEnabled) {
                Label("Allow Camera", systemImage: "camera")
            }

            Picker(selection: execApprovalModeBinding) {
                ForEach(ExecApprovalQuickMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            } label: {
                Label("Exec Approvals", systemImage: "terminal")
            }

            Toggle(isOn: canvasBinding) {
                Label("Allow Canvas", systemImage: "rectangle.and.pencil.and.ellipsis")
            }
            .onChange(of: appState.canvasEnabled) { _, enabled in
                if !enabled {
                    CanvasManager.shared.hideAll()
                }
            }

            Toggle(isOn: voiceWakeBinding) {
                Label("Voice Wake", systemImage: "mic.fill")
            }
            .disabled(!voiceWakeSupported)
            .opacity(voiceWakeSupported ? 1 : 0.5)

            if showVoiceWakeMicPicker {
                voiceWakeMicMenu
            }

            Divider()

            // MARK: - Quick Actions

            Button {
                Task { @MainActor in
                    await openDashboard()
                }
            } label: {
                Label("Open Dashboard", systemImage: "gauge")
            }

            Button {
                Task { @MainActor in
                    let sessionKey = await WebChatManager.shared.preferredSessionKey()
                    WebChatManager.shared.show(sessionKey: sessionKey)
                }
            } label: {
                Label("Open Chat", systemImage: "bubble.left.and.bubble.right")
            }

            if appState.canvasEnabled {
                Button {
                    Task { @MainActor in
                        if appState.canvasPanelVisible {
                            CanvasManager.shared.hideAll()
                        } else {
                            let sessionKey = await GatewayConnection.shared.mainSessionKey()
                            _ = try? CanvasManager.shared.show(sessionKey: sessionKey, path: nil)
                        }
                    }
                } label: {
                    Label(
                        appState.canvasPanelVisible ? "Close Canvas" : "Open Canvas",
                        systemImage: "rectangle.inset.filled.on.rectangle")
                }
            }

            Button {
                Task { await appState.setTalkEnabled(!appState.talkEnabled) }
            } label: {
                Label(
                    appState.talkEnabled ? "Stop Talk Mode" : "Talk Mode",
                    systemImage: "waveform.circle.fill")
            }
            .disabled(!voiceWakeSupported)
            .opacity(voiceWakeSupported ? 1 : 0.5)

            Divider()

            // MARK: - Sessions

            if appState.activeSessions.isEmpty {
                Text("No active sessions")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            } else {
                ForEach(appState.activeSessions) { session in
                    SessionMenuLabelView(session: session)
                }
            }

            Divider()

            // MARK: - Bottom Actions

            Button("Settings…") { open(tab: .general) }
                .keyboardShortcut(",", modifiers: [.command])

            debugMenu

            Button("About CoreBlow") { open(tab: .general) }

            Button("Quit") { NSApplication.shared.terminate(nil) }
        }
        .frame(width: 300)
        .task(id: appState.swabbleEnabled) {
            if appState.swabbleEnabled {
                await loadMicrophones(force: true)
            }
        }
        .task {
            VoicePushToTalkHotkey.shared.setEnabled(voiceWakeSupported && appState.voicePushToTalkEnabled)
        }
        .onChange(of: appState.voicePushToTalkEnabled) { _, enabled in
            VoicePushToTalkHotkey.shared.setEnabled(voiceWakeSupported && enabled)
        }
        .task(id: appState.connectionMode) {
            await loadBrowserControlEnabled()
        }
        .onAppear {
            MicRefreshSupport.startObserver(micObserver) {
                MicRefreshSupport.schedule(refreshTask: &micRefreshTask) {
                    await loadMicrophones(force: true)
                }
            }
        }
        .onDisappear {
            micRefreshTask?.cancel()
            micRefreshTask = nil
            micObserver.stop()
        }
        .task { @MainActor in
            SettingsWindowOpener.shared.register(openSettings: openSettings)
        }
    }

    // MARK: - Connection Label

    private var connectionLabel: String {
        switch appState.connectionMode {
        case .unconfigured: "CoreBlow Not Configured"
        case .remote: "Remote CoreBlow Active"
        case .local: "CoreBlow Active"
        }
    }

    // MARK: - Health Status

    private var healthStatusLabel: String {
        appState.isGatewayConnected ? "Health ok" : "Offline"
    }

    private var healthStatusColor: Color {
        appState.isGatewayConnected ? .green : .secondary
    }

    // MARK: - Heartbeat Status

    private var heartbeatStatusLabel: String {
        "Heartbeat active"
    }

    private var heartbeatStatusColor: Color {
        .blue
    }

    // MARK: - Browser Control

    private func loadBrowserControlEnabled() async {
        let root = await ConfigStore.load()
        let browser = root["browser"] as? [String: Any]
        let enabled = browser?["enabled"] as? Bool ?? true
        await MainActor.run { browserControlEnabled = enabled }
    }

    private func saveBrowserControlEnabled(_ enabled: Bool) async {
        let (success, _) = await MenuContentView.buildAndSaveBrowserEnabled(enabled)
        if !success {
            await loadBrowserControlEnabled()
        }
    }

    @MainActor
    private static func buildAndSaveBrowserEnabled(_ enabled: Bool) async -> (Bool, ()) {
        var root = await ConfigStore.load()
        var browser = root["browser"] as? [String: Any] ?? [:]
        browser["enabled"] = enabled
        root["browser"] = browser
        do {
            try await ConfigStore.save(root)
            return (true, ())
        } catch {
            return (false, ())
        }
    }

    // MARK: - Status Line

    private func statusLine(label: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
                .lineLimit(nil)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
        }
        .padding(.top, 2)
    }

    // MARK: - Bindings

    private var activeBinding: Binding<Bool> {
        Binding(get: { !appState.isPaused }, set: { appState.isPaused = !$0 })
    }

    private var heartbeatsBinding: Binding<Bool> {
        Binding(get: { appState.heartbeatsEnabled }, set: { appState.heartbeatsEnabled = $0 })
    }

    private var voiceWakeBinding: Binding<Bool> {
        Binding(
            get: { appState.swabbleEnabled },
            set: { appState.setSwabbleEnabled($0) })
    }

    private var canvasBinding: Binding<Bool> {
        Binding(
            get: { appState.canvasEnabled },
            set: { appState.canvasEnabled = $0 })
    }

    // MARK: - Voice Wake Mic Picker

    private var showVoiceWakeMicPicker: Bool {
        voiceWakeSupported && appState.swabbleEnabled
    }

    private var voiceWakeMicMenu: some View {
        Menu {
            microphoneMenuItems

            if loadingMics {
                Divider()
                Label("Refreshing microphones…", systemImage: "arrow.triangle.2.circlepath")
                    .labelStyle(.titleOnly)
                    .foregroundStyle(.secondary)
                    .disabled(true)
            }
        } label: {
            HStack {
                Text("Microphone")
                Spacer()
                Text(selectedMicLabel)
                    .foregroundStyle(.secondary)
            }
        }
        .task { await loadMicrophones() }
    }

    private var selectedMicLabel: String {
        if appState.voiceWakeMicID.isEmpty { return defaultMicLabel }
        if let match = availableMics.first(where: { $0.uid == appState.voiceWakeMicID }) {
            return match.name
        }
        if !appState.voiceWakeMicName.isEmpty { return appState.voiceWakeMicName }
        return "Unavailable"
    }

    private var microphoneMenuItems: some View {
        Group {
            if isSelectedMicUnavailable {
                Label("Disconnected (using System default)", systemImage: "exclamationmark.triangle")
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(.secondary)
                    .disabled(true)
                Divider()
            }
            Button {
                appState.voiceWakeMicID = ""
                appState.voiceWakeMicName = ""
            } label: {
                Label(defaultMicLabel, systemImage: appState.voiceWakeMicID.isEmpty ? "checkmark" : "")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.plain)

            ForEach(availableMics) { mic in
                Button {
                    appState.voiceWakeMicID = mic.uid
                    appState.voiceWakeMicName = mic.name
                } label: {
                    Label(mic.name, systemImage: appState.voiceWakeMicID == mic.uid ? "checkmark" : "")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var isSelectedMicUnavailable: Bool {
        let selected = appState.voiceWakeMicID
        guard !selected.isEmpty else { return false }
        return !availableMics.contains(where: { $0.uid == selected })
    }

    private var defaultMicLabel: String {
        if let host = Host.current().localizedName, !host.isEmpty {
            return "Auto-detect (\(host))"
        }
        return "System default"
    }

    // MARK: - Microphone Loading

    @MainActor
    private func loadMicrophones(force: Bool = false) async {
        guard showVoiceWakeMicPicker else {
            availableMics = []
            loadingMics = false
            return
        }
        if !force, !availableMics.isEmpty { return }
        loadingMics = true
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.external, .microphone],
            mediaType: .audio,
            position: .unspecified)
        let connectedDevices = discovery.devices.filter(\.isConnected)
        availableMics = connectedDevices
            .sorted { lhs, rhs in
                lhs.localizedName.localizedCaseInsensitiveCompare(rhs.localizedName) == .orderedAscending
            }
            .map { AudioInputDevice(uid: $0.uniqueID, name: $0.localizedName) }
        availableMics = filterAliveInputs(availableMics)
        appState.voiceWakeMicName = MicRefreshSupport.selectedMicName(
            selectedID: appState.voiceWakeMicID,
            in: availableMics,
            uid: \.uid,
            name: \.name)
        loadingMics = false
    }

    private func filterAliveInputs(_ inputs: [AudioInputDevice]) -> [AudioInputDevice] {
        let aliveUIDs = AudioInputDeviceObserver.aliveInputDeviceUIDs()
        guard !aliveUIDs.isEmpty else { return inputs }
        return inputs.filter { aliveUIDs.contains($0.uid) }
    }

    // MARK: - Debug Menu

    @ViewBuilder
    private var debugMenu: some View {
        if appState.debugPaneEnabled {
            Menu("Debug") {
                Button {
                    let configDir = CoreBlowPaths.configFile.deletingLastPathComponent()
                    NSWorkspace.shared.open(configDir)
                } label: {
                    Label("Open Config Folder", systemImage: "folder")
                }

                Button {
                    Task {
                        let result = await GatewayConnection.shared.status()
                        let alert = NSAlert()
                        alert.messageText = "Health Check"
                        alert.informativeText = result.ok ? "Gateway healthy" : (result.error ?? "Unknown error")
                        alert.alertStyle = result.ok ? .informational : .warning
                        alert.runModal()
                    }
                } label: {
                    Label("Run Health Check Now", systemImage: "stethoscope")
                }

                Button {
                    Task { _ = await DebugActions.sendTestHeartbeat() }
                } label: {
                    Label("Send Test Heartbeat", systemImage: "waveform.path.ecg")
                }

                if appState.connectionMode == .remote {
                    Button {
                        Task { @MainActor in
                            let result = await DebugActions.resetGatewayTunnel()
                            presentDebugResult(result, title: "Remote Tunnel")
                        }
                    } label: {
                        Label("Reset Remote Tunnel", systemImage: "arrow.triangle.2.circlepath")
                    }
                }

                Button {
                    Task { _ = await DebugActions.toggleVerboseLoggingMain() }
                } label: {
                    Label(
                        DebugActions.verboseLoggingEnabledMain
                            ? "Verbose Logging (Main): On"
                            : "Verbose Logging (Main): Off",
                        systemImage: "text.alignleft")
                }

                Menu {
                    Picker("Verbosity", selection: $appLogLevelRaw) {
                        ForEach(AppLogLevel.allCases) { level in
                            Text(level.title).tag(level.rawValue)
                        }
                    }
                    Toggle(isOn: $appFileLoggingEnabled) {
                        Label(
                            appFileLoggingEnabled
                                ? "File Logging: On"
                                : "File Logging: Off",
                            systemImage: "doc.text.magnifyingglass")
                    }
                } label: {
                    Label("App Logging", systemImage: "doc.text")
                }

                Button {
                    DebugActions.openSessionStore()
                } label: {
                    Label("Open Session Store", systemImage: "externaldrive")
                }

                Divider()

                Button {
                    DebugActions.openAgentEventsWindow()
                } label: {
                    Label("Open Agent Events…", systemImage: "bolt.horizontal.circle")
                }

                Button {
                    DebugActions.openLog()
                } label: {
                    Label("Open Log", systemImage: "doc.text.magnifyingglass")
                }

                Button {
                    Task {
                        _ = await GatewayConnection.shared.sendAgent(
                            message: "Hello from debug voice",
                            thinking: "default",
                            sessionKey: "main",
                            deliver: false,
                            to: nil)
                    }
                } label: {
                    Label("Send Debug Voice Text", systemImage: "waveform.circle")
                }

                Button {
                    Task { await DebugActions.sendTestNotification() }
                } label: {
                    Label("Send Test Notification", systemImage: "bell")
                }

                Divider()

                if appState.connectionMode == .local {
                    Button {
                        DebugActions.restartGateway()
                    } label: {
                        Label("Restart Gateway", systemImage: "arrow.clockwise")
                    }
                }

                Button {
                    DebugActions.restartOnboarding()
                } label: {
                    Label("Restart Onboarding", systemImage: "arrow.counterclockwise")
                }

                Button {
                    let url = Bundle.main.bundleURL
                    let config = NSWorkspace.OpenConfiguration()
                    config.createsNewApplicationInstance = true
                    NSWorkspace.shared.openApplication(at: url, configuration: config) { _, _ in
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            NSApp.terminate(nil)
                        }
                    }
                } label: {
                    Label("Restart App", systemImage: "arrow.triangle.2.circlepath")
                }
            }
        }
    }

    // MARK: - Navigation

    private func open(tab: SettingsTab) {
        SettingsTabRouter.open(tab: tab)
        NSApp.activate(ignoringOtherApps: true)
    }

    @MainActor
    private func openDashboard() async {
        do {
            let config = try await GatewayEndpointStore.shared.requireConfig()
            let url = try GatewayEndpointStore.dashboardURL(for: config, mode: appState.connectionMode)
            NSWorkspace.shared.open(url)
        } catch {
            let alert = NSAlert()
            alert.messageText = "Dashboard unavailable"
            alert.informativeText = error.localizedDescription
            alert.runModal()
        }
    }

    @MainActor
    private func presentDebugResult(_ result: Result<String, DebugActionError>, title: String) {
        let alert = NSAlert()
        alert.messageText = title
        switch result {
        case let .success(message):
            alert.informativeText = message
            alert.alertStyle = .informational
        case let .failure(error):
            alert.informativeText = error.localizedDescription
            alert.alertStyle = .warning
        }
        alert.runModal()
    }

    // MARK: - Audio Input Device

    private struct AudioInputDevice: Identifiable, Equatable {
        let uid: String
        let name: String
        var id: String { uid }
    }
}
