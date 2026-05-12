import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Observation
import CoreBlowKit
import SwiftUI

// MARK: - General Settings

struct GeneralSettings: View {
    @State private var appState = AppStateStore.shared
    @AppStorage("coreblow.camera.enabled") private var cameraEnabled: Bool = false
    @State private var gatewayStatus: GatewayStatusKind = .checking
    @State private var remoteStatus: RemoteTestStatus = .idle
    @State private var showRemoteAdvanced = false

    private let remoteLabelWidth: CGFloat = 88

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    SettingsToggleRow(
                        title: "CoreBlow active",
                        subtitle: "Pause to stop the CoreBlow gateway; no messages will be processed.",
                        isOn: Binding(
                            get: { !appState.isPaused },
                            set: { appState.isPaused = !$0 }))

                    connectionSection

                    Divider()

                    SettingsToggleRow(
                        title: "Launch at login",
                        subtitle: "Automatically start CoreBlow after you sign in.",
                        isOn: $appState.launchAtLogin)

                    SettingsToggleRow(
                        title: "Show Dock icon",
                        subtitle: "Keep CoreBlow visible in the Dock instead of menu-bar-only mode.",
                        isOn: $appState.showDockIcon)

                    SettingsToggleRow(
                        title: "Play menu bar icon animations",
                        subtitle: "Enable idle blinks and wiggles on the status icon.",
                        isOn: $appState.iconAnimationsEnabled)

                    SettingsToggleRow(
                        title: "Allow Canvas",
                        subtitle: "Allow the agent to show and control the Canvas panel.",
                        isOn: $appState.canvasEnabled)

                    SettingsToggleRow(
                        title: "Allow Camera",
                        subtitle: "Allow the agent to capture a photo or short video via the built-in camera.",
                        isOn: $cameraEnabled)

                    SettingsToggleRow(
                        title: "Enable Peekaboo Bridge",
                        subtitle: "Allow signed tools (e.g. `peekaboo`) to drive UI automation via PeekabooBridge.",
                        isOn: $appState.peekabooBridgeEnabled)

                    SettingsToggleRow(
                        title: "Enable debug tools",
                        subtitle: "Show the Debug tab with development utilities.",
                        isOn: $appState.debugPaneEnabled)
                }

                Spacer(minLength: 12)
                HStack {
                    Spacer()
                    Button("Quit CoreBlow") { NSApp.terminate(nil) }
                        .buttonStyle(.borderedProminent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 22)
            .padding(.bottom, 16)
        }
        .onAppear { refreshGatewayStatus() }
        .onChange(of: appState.canvasEnabled) { _, enabled in
            if !enabled {
                CanvasManager.shared.hideAll()
            }
        }
    }

    // MARK: - Connection Section

    private var connectionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CoreBlow runs")
                .font(.title3.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .leading)

            Picker("Mode", selection: $appState.connectionMode) {
                Text("Not configured").tag(AppState.ConnectionMode.unconfigured)
                Text("Local (this Mac)").tag(AppState.ConnectionMode.local)
                Text("Remote (another host)").tag(AppState.ConnectionMode.remote)
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .frame(width: 260, alignment: .leading)

            if appState.connectionMode == .unconfigured {
                Text("Pick Local or Remote to start the Gateway.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if appState.connectionMode == .local {
                gatewayInstallerCard
                healthRow
            }

            if appState.connectionMode == .remote {
                remoteCard
            }
        }
    }

    // MARK: - Remote Card

    private var remoteCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            remoteTransportRow

            if appState.remoteTransport == .ssh {
                remoteSshRow
            } else {
                remoteDirectRow
            }
            remoteTokenRow

            remoteStatusView
                .padding(.leading, remoteLabelWidth + 10)

            if appState.remoteTransport == .ssh {
                DisclosureGroup(isExpanded: $showRemoteAdvanced) {
                    VStack(alignment: .leading, spacing: 8) {
                        LabeledContent("Identity file") {
                            TextField("/Users/you/.ssh/id_ed25519", text: $appState.remoteIdentity)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 280)
                        }
                        LabeledContent("Project root") {
                            TextField("/home/you/Projects/coreblow", text: $appState.remoteProjectRoot)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 280)
                        }
                        LabeledContent("CLI path") {
                            TextField("/Applications/CoreBlow.app/.../coreblow", text: $appState.remoteCliPath)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 280)
                        }
                    }
                    .padding(.top, 4)
                } label: {
                    Text("Advanced")
                        .font(.callout.weight(.semibold))
                }
            }

            // Control channel diagnostics
            controlChannelDiagnostics

            if appState.remoteTransport == .ssh {
                Text("Tip: enable Tailscale for stable remote access.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text("Tip: use Tailscale Serve so the gateway has a valid HTTPS cert.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .transition(.opacity)
    }

    // MARK: - Control Channel Diagnostics

    private var controlChannelDiagnostics: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Control channel")
                .font(.caption.weight(.semibold))
            Text(controlStatusLine)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var controlStatusLine: String {
        // Placeholder for ControlChannel.shared.state integration
        "Connected"
    }

    private var remoteTransportRow: some View {
        HStack(alignment: .center, spacing: 10) {
            Text("Transport")
                .font(.callout.weight(.semibold))
                .frame(width: remoteLabelWidth, alignment: .leading)
            Picker("Transport", selection: $appState.remoteTransport) {
                Text("SSH tunnel").tag(AppState.RemoteTransport.ssh)
                Text("Direct (ws/wss)").tag(AppState.RemoteTransport.direct)
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 320)
        }
    }

    private var remoteSshRow: some View {
        let trimmedTarget = appState.remoteTarget.trimmingCharacters(in: .whitespacesAndNewlines)
        let validationMessage = CommandResolver.sshTargetValidationMessage(trimmedTarget)
        let canTest = !trimmedTarget.isEmpty && validationMessage == nil

        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 10) {
                Text("SSH target")
                    .font(.callout.weight(.semibold))
                    .frame(width: remoteLabelWidth, alignment: .leading)
                TextField("user@host[:22]", text: $appState.remoteTarget)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: .infinity)
                remoteTestButton(disabled: !canTest)
            }
            if let validationMessage {
                Text(validationMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.leading, remoteLabelWidth + 10)
            }
        }
    }

    private var remoteDirectRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                Text("Gateway")
                    .font(.callout.weight(.semibold))
                    .frame(width: remoteLabelWidth, alignment: .leading)
                TextField("wss://gateway.example.ts.net", text: $appState.remoteUrl)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: .infinity)
                remoteTestButton(
                    disabled: appState.remoteUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Text("Direct mode requires wss:// for remote hosts. ws:// is only allowed for localhost/127.0.0.1.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.leading, remoteLabelWidth + 10)
        }
    }

    private var remoteTokenRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 10) {
                Text("Gateway token")
                    .font(.callout.weight(.semibold))
                    .frame(width: remoteLabelWidth, alignment: .leading)
                SecureField("remote gateway auth token (gateway.remote.token)", text: $appState.remoteToken)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: .infinity)
            }
            Text("Used when the remote gateway requires token auth.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.leading, remoteLabelWidth + 10)
        }
    }

    private func remoteTestButton(disabled: Bool) -> some View {
        Button {
            Task { await testRemote() }
        } label: {
            if remoteStatus == .checking {
                ProgressView().controlSize(.small)
            } else {
                Text("Test remote")
            }
        }
        .buttonStyle(.borderedProminent)
        .disabled(remoteStatus == .checking || disabled)
    }

    @ViewBuilder
    private var remoteStatusView: some View {
        switch remoteStatus {
        case .idle:
            EmptyView()
        case .checking:
            Text("Testing…")
                .font(.caption)
                .foregroundStyle(.secondary)
        case .ok(let msg):
            Label(msg, systemImage: "checkmark.circle.fill")
                .font(.caption)
                .foregroundStyle(.green)
        case .failed(let msg):
            Text(msg)
                .font(.caption)
                .foregroundStyle(.red)
                .lineLimit(2)
        }
    }

    // MARK: - Gateway Installer Card

    private var gatewayInstallerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Circle()
                    .fill(gatewayStatusColor)
                    .frame(width: 10, height: 10)
                Text(gatewayStatusMessage)
                    .font(.callout)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let gatewayVersion = gatewayVersionString {
                Text("Gateway \(gatewayVersion) detected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Button("Recheck") { refreshGatewayStatus() }
                .buttonStyle(.bordered)

            Text("Gateway auto-starts in local mode via launchd.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(12)
        .background(Color.gray.opacity(0.08))
        .cornerRadius(10)
    }

    private var gatewayVersionString: String? {
        // Populated from gateway environment check
        nil
    }

    // MARK: - Health Row

    private var healthRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Circle()
                    .fill(gatewayStatusColor)
                    .frame(width: 10, height: 10)
                Text("Gateway health")
                    .font(.callout)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 10) {
                Button("Retry now") {
                    refreshGatewayStatus()
                }
                .font(.caption)

                Button("Open logs") { revealLogs() }
                    .buttonStyle(.link)
                    .foregroundStyle(.secondary)
                    .font(.caption)
            }
        }
    }

    // MARK: - Health Card (full diagnostics)

    private var healthCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Circle()
                    .fill(gatewayStatusColor)
                    .frame(width: 10, height: 10)
                Text("Health overview")
                    .font(.callout.weight(.semibold))
            }

            Text("Session store: ~/.coreblow/sessions")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Button {
                    refreshGatewayStatus()
                } label: {
                    Label("Run Health Check", systemImage: "arrow.clockwise")
                }

                Divider().frame(height: 18)

                Button {
                    revealLogs()
                } label: {
                    Label("Reveal Logs", systemImage: "doc.text.magnifyingglass")
                }
            }
        }
        .padding(12)
        .background(Color.gray.opacity(0.08))
        .cornerRadius(10)
    }

    // MARK: - Helpers

    private func refreshGatewayStatus() {
        Task {
            gatewayStatus = .checking
            let result = await GatewayConnection.shared.status()
            gatewayStatus = result.ok ? .ok : .error(result.error ?? "Unknown")
        }
    }

    @MainActor
    private func testRemote() async {
        remoteStatus = .checking
        let result = await GatewayConnection.shared.status()
        if result.ok {
            remoteStatus = .ok("Connected successfully")
        } else {
            remoteStatus = .failed(result.error ?? "Connection failed")
        }
    }

    private func revealLogs() {
        let logDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".coreblow/logs")
        if FileManager.default.fileExists(atPath: logDir.path) {
            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: logDir.path)
            return
        }

        let alert = NSAlert()
        alert.messageText = "Log file not found"
        alert.informativeText = """
        Looked for coreblow logs in ~/.coreblow/logs/.
        Run a health check or send a message to generate activity, then try again.
        """
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    private var gatewayStatusColor: Color {
        switch gatewayStatus {
        case .ok: .green
        case .checking: .secondary
        case .error: .orange
        }
    }

    private var gatewayStatusMessage: String {
        switch gatewayStatus {
        case .ok: "Gateway ready"
        case .checking: "Checking..."
        case .error(let msg): msg
        }
    }
}

// MARK: - Supporting Types

private enum GatewayStatusKind {
    case ok
    case checking
    case error(String)
}

private enum RemoteTestStatus: Equatable {
    case idle
    case checking
    case ok(String)
    case failed(String)
}

// MARK: - Gateway Environment Status

private enum GatewayEnvironmentStatus: Equatable {
    case unknown
    case healthy(version: String?)
    case degraded(reason: String)
    case unavailable

    var label: String {
        switch self {
        case .unknown:
            "Checking gateway environment…"
        case let .healthy(version):
            if let version {
                "Gateway \(version) healthy"
            } else {
                "Gateway healthy"
            }
        case let .degraded(reason):
            "Degraded: \(reason)"
        case .unavailable:
            "Gateway unavailable"
        }
    }

    var tint: Color {
        switch self {
        case .unknown: .secondary
        case .healthy: .green
        case .degraded: .orange
        case .unavailable: .red
        }
    }
}

// GatewayDiscoveryInlineList is defined in GatewayDiscoveryMenu.swift
// TailscaleIntegrationSection is defined in TailscaleIntegrationSection.swift
// SettingsToggleRow is defined in SettingsHelpers.swift

#if DEBUG
extension GeneralSettings {
    @MainActor
    static func exerciseForTesting() {
        let state = AppStateStore.shared
        state.connectionMode = .remote
        state.remoteTransport = .ssh
        state.remoteTarget = "user@host:2222"
        state.remoteUrl = "wss://gateway.example.ts.net"
        state.remoteToken = "example-token"
        state.remoteIdentity = "/tmp/id_ed25519"
        state.remoteProjectRoot = "/tmp/coreblow"
        state.remoteCliPath = "/tmp/coreblow"

        let view = GeneralSettings()
        _ = view.body

        state.connectionMode = .unconfigured
        _ = view.body

        state.connectionMode = .local
        _ = view.body
    }
}
#endif
