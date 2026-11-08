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
    @AppStorage("coreblow.studio.language") private var studioLanguage: String = "ID"
    @AppStorage("coreblow.fullAccess") private var fullAccess: Bool = true
    @AppStorage("coreblow.defaultWorkspacePerms") private var defaultWorkspacePerms: Bool = true
    @State private var showAdvancedOptions: Bool = false
    @State private var gatewayStatus: GatewayStatusKind = .checking
    @State private var remoteStatus: RemoteTestStatus = .idle
    @State private var showRemoteAdvanced = false

    private let remoteLabelWidth: CGFloat = 88
    private var isID: Bool { self.studioLanguage == "ID" }

    init(state _: AppState? = nil) {}

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 20) {
                // Card 1: STATUS & MODE LAYANAN (SERVICE MODE)
                VStack(alignment: .leading, spacing: 6) {
                    StudioSettingsCardHeader(self.isID ? "STATUS & MODE LAYANAN" : "SERVICE MODE")
                    StudioSettingsCard {
                        StudioSettingsRow(
                            title: self.isID ? "CoreBlow Aktif" : "CoreBlow Active",
                            subtitle: self.isID ? "Jeda layanan untuk menghentikan pemrosesan pesan." : "Pause to stop processing messages."
                        ) {
                            StudioToggleSwitch(
                                isOn: Binding(
                                    get: { !self.appState.isPaused },
                                    set: { self.appState.isPaused = !$0 }
                                )
                            )
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Mode Layanan" : "Connection Mode",
                            subtitle: self.isID ? "Pilih apakah CoreBlow berjalan mandiri di Mac ini (Lokal) atau terhubung ke server remote." : "Choose whether CoreBlow runs locally on this Mac or connects to a remote server."
                        ) {
                            Picker("Mode", selection: self.$appState.connectionMode) {
                                Text(self.isID ? "Belum Dikonfigurasi" : "Not configured").tag(AppState.ConnectionMode.unconfigured)
                                Text(self.isID ? "Lokal (Mac ini)" : "Local (this Mac)").tag(AppState.ConnectionMode.local)
                                Text(self.isID ? "Remote (Server luar)" : "Remote (another host)").tag(AppState.ConnectionMode.remote)
                            }
                            .pickerStyle(.menu)
                            .labelsHidden()
                            .frame(width: 175)
                        }

                        if self.appState.connectionMode == .unconfigured {
                            StudioSettingsDivider()
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(self.isID ? "Layanan belum aktif" : "Service not started")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Color(red: 255/255.0, green: 180/255.0, blue: 70/255.0))
                                    Text(self.isID ? "Klik tombol di kanan untuk langsung mengaktifkan Mode Lokal di Mac ini." : "Click activate to immediately start CoreBlow in Local Mode on this Mac.")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Color.white.opacity(0.55))
                                }
                                Spacer()
                                Button(self.isID ? "Aktifkan Mode Lokal" : "Activate Local Mode") {
                                    self.appState.connectionMode = .local
                                    Task {
                                        await ConnectionModeCoordinator.shared.apply(mode: .local, paused: self.appState.isPaused)
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Color(red: 96/255.0, green: 217/255.0, blue: 204/255.0))
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                        } else if self.appState.connectionMode == .local {
                            StudioSettingsDivider()
                            self.healthRow
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                        } else if self.appState.connectionMode == .remote {
                            StudioSettingsDivider()
                            self.remoteCard
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                        }
                    }
                }

                // Card 2: IZIN KERJA ASISTEN (PERMISSIONS)
                VStack(alignment: .leading, spacing: 6) {
                    StudioSettingsCardHeader(self.isID ? "IZIN KERJA ASISTEN" : "PERMISSIONS")
                    StudioSettingsCard {
                        StudioSettingsRow(
                            title: self.isID ? "Izin Standar Workspace" : "Default permissions",
                            subtitle: self.isID ? "Secara default, asisten dapat membaca dan menyunting berkas di folder proyek yang Anda pilih." : "By default, CoreBlow can read and edit files in its workspace. It can ask for additional access when needed."
                        ) {
                            StudioToggleSwitch(isOn: self.$defaultWorkspacePerms)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Akses Penuh (Full access)" : "Full access",
                            subtitle: self.isID ? "Mengizinkan eksekusi perintah terminal mandiri dan akses jaringan tanpa meminta persetujuan berulang." : "When CoreBlow runs with full access, it can edit files and run commands without repeated approval."
                        ) {
                            StudioToggleSwitch(isOn: self.$fullAccess)
                        }
                    }
                }

                // Card 3: PREFERENSI UMUM (GENERAL PREFERENCES)
                VStack(alignment: .leading, spacing: 6) {
                    StudioSettingsCardHeader(self.isID ? "PREFERENSI UMUM" : "GENERAL PREFERENCES")
                    StudioSettingsCard {
                        StudioSettingsRow(
                            title: self.isID ? "Lokasi Obrolan Bebas Proyek" : "Projectless chat folder",
                            subtitle: self.isID ? "Lokasi penyimpanan riwayat percakapan harian yang dimulai di luar proyek." : "Where chats started outside of projects store their conversation data by default."
                        ) {
                            HStack(spacing: 8) {
                                Text("~/.coreblow/chats")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Color.white.opacity(0.6))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(RoundedRectangle(cornerRadius: 5).fill(Color.white.opacity(0.04)))

                                Button(self.isID ? "Ubah" : "Change") {
                                    let panel = NSOpenPanel()
                                    panel.canChooseFiles = false
                                    panel.canChooseDirectories = true
                                    panel.allowsMultipleSelection = false
                                    _ = panel.runModal()
                                }
                                .buttonStyle(.bordered)
                                .font(.system(size: 11))
                            }
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Bahasa Antarmuka (Language)" : "Language",
                            subtitle: self.isID ? "Pilih bahasa tampilan untuk antarmuka pengguna CoreBlow Studio." : "Language for the CoreBlow Studio user interface."
                        ) {
                            Picker("Language", selection: self.$studioLanguage) {
                                Text("Bahasa Indonesia").tag("ID")
                                Text("English").tag("EN")
                            }
                            .pickerStyle(.menu)
                            .labelsHidden()
                            .frame(width: 155)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Jalankan Otomatis saat Login" : "Launch at login",
                            subtitle: self.isID ? "Otomatis memulai layanan CoreBlow setelah Anda masuk ke macOS." : "Automatically start CoreBlow after you sign in."
                        ) {
                            StudioToggleSwitch(isOn: self.$appState.launchAtLogin)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Tampilkan Ikon di Dock" : "Show Dock icon",
                            subtitle: self.isID ? "Tampilkan ikon CoreBlow di Dock macOS (selain di Menu Bar)." : "Keep CoreBlow visible in the Dock instead of menu-bar-only mode."
                        ) {
                            StudioToggleSwitch(isOn: self.$appState.showDockIcon)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: self.isID ? "Animasi Ikon Menu Bar" : "Play menu bar icon animations",
                            subtitle: self.isID ? "Aktifkan animasi kedipan halus pada ikon status bilah menu." : "Enable idle blinks and wiggles on the status icon."
                        ) {
                            StudioToggleSwitch(isOn: self.$appState.iconAnimationsEnabled)
                        }
                    }
                }

                // Card 4: PENGATURAN LANJUTAN (ADVANCED DEVELOPER OPTIONS)
                VStack(alignment: .leading, spacing: 6) {
                    DisclosureGroup(isExpanded: self.$showAdvancedOptions) {
                        StudioSettingsCard {
                            StudioSettingsRow(
                                title: self.isID ? "Izinkan Canvas Panel" : "Allow Canvas",
                                subtitle: self.isID ? "Izinkan asisten untuk menampilkan dan mengontrol kanvas visual interaktif." : "Allow the agent to show and control the Canvas panel."
                            ) {
                                StudioToggleSwitch(isOn: self.$appState.canvasEnabled)
                            }

                            StudioSettingsDivider()

                            StudioSettingsRow(
                                title: self.isID ? "Izinkan Kamera" : "Allow Camera",
                                subtitle: self.isID ? "Izinkan asisten mengambil foto untuk analisis visual dengan kamera Mac." : "Allow the agent to capture a photo or short video via the built-in camera."
                            ) {
                                StudioToggleSwitch(isOn: self.$cameraEnabled)
                            }

                            StudioSettingsDivider()

                            StudioSettingsRow(
                                title: self.isID ? "Jembatan Otomasi UI (Peekaboo)" : "Enable Peekaboo Bridge",
                                subtitle: self.isID ? "Izinkan alat otomatisasi antarmuka macOS untuk tugas operasional." : "Allow signed tools to drive UI automation via PeekabooBridge."
                            ) {
                                StudioToggleSwitch(isOn: self.$appState.peekabooBridgeEnabled)
                            }

                            StudioSettingsDivider()

                            StudioSettingsRow(
                                title: self.isID ? "Aktifkan Tab Debug" : "Enable debug tools",
                                subtitle: self.isID ? "Tampilkan tab diagnostik dan inspeksi log developer di bilah pengaturan." : "Show the Debug tab with development utilities."
                            ) {
                                StudioToggleSwitch(isOn: self.$appState.debugPaneEnabled)
                            }
                        }
                        .padding(.top, 4)
                    } label: {
                        Text(self.isID ? "PENGATURAN LANJUTAN (DEVELOPER OPTIONS)" : "ADVANCED DEVELOPER OPTIONS")
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.white.opacity(0.42))
                    }
                }

                Spacer(minLength: 12)

                // Footer Quit Button
                HStack {
                    Spacer()
                    Button(action: { NSApp.terminate(nil) }) {
                        HStack(spacing: 6) {
                            Image(systemName: "power")
                                .font(.system(size: 11, weight: .semibold))
                            Text(self.isID ? "Keluar dari CoreBlow" : "Quit CoreBlow")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(Color(red: 255/255.0, green: 120/255.0, blue: 120/255.0))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color(red: 255/255.0, green: 70/255.0, blue: 70/255.0).opacity(0.12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .stroke(Color(red: 255/255.0, green: 70/255.0, blue: 70/255.0).opacity(0.25), lineWidth: 0.5)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
        }
        .onAppear { self.refreshGatewayStatus() }
        .onChange(of: self.appState.canvasEnabled) { _, enabled in
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
                .foregroundStyle(.white)
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
                    .foregroundStyle(Color.white.opacity(0.55))
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

private enum GatewayEnvStatusView: Equatable {
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
