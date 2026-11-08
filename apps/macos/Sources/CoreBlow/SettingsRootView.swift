import AppKit
import OSLog
import CoreBlowKit
import Observation
import SwiftUI

// MARK: - Clustered Sidebar Categories (Option 1 Sovereign Design System)

enum StudioSettingsCluster: String, CaseIterable, Identifiable {
    case personal = "PERSONAL"
    case integrations = "INTEGRATIONS"
    case coding = "CODING & SYSTEM"

    var id: String { self.rawValue }

    func localizedTitle(isID: Bool) -> String {
        switch self {
        case .personal: return isID ? "PENGATURAN PRIBADI" : "PERSONAL"
        case .integrations: return isID ? "INTEGRASI & EKOSISTEM" : "INTEGRATIONS"
        case .coding: return isID ? "ALAT PENGEMBANG & SISTEM" : "CODING & SYSTEM"
        }
    }
}

// MARK: - Settings Tab Definition (Strict Backward Compatibility)

enum SettingsTab: CaseIterable {
    case general, channels, skills, sessions, cron, config, instances, voiceWake, permissions, debug, about

    static let windowWidth: CGFloat = 920
    static let windowHeight: CGFloat = 680

    var cluster: StudioSettingsCluster {
        switch self {
        case .general, .voiceWake, .permissions, .sessions:
            return .personal
        case .config, .channels, .instances:
            return .integrations
        case .skills, .cron, .debug, .about:
            return .coding
        }
    }

    var title: String {
        switch self {
        case .general: "General"
        case .channels: "Channels"
        case .skills: "Skills"
        case .sessions: "Sessions"
        case .cron: "Cron"
        case .config: "Config"
        case .instances: "Instances"
        case .voiceWake: "Voice Wake"
        case .permissions: "Permissions"
        case .debug: "Debug"
        case .about: "About"
        }
    }

    func localizedTitle(isID: Bool) -> String {
        switch self {
        case .general: return isID ? "Umum" : "General"
        case .voiceWake: return isID ? "Suara & Panggilan" : "Voice & Sound"
        case .permissions: return isID ? "Izin & Keamanan" : "Permissions & Safety"
        case .sessions: return isID ? "Memori & Sesi" : "Storage & Sessions"
        case .config: return isID ? "Kunci API & Model" : "API Keys & Models"
        case .channels: return isID ? "Saluran Pesan" : "Messaging Channels"
        case .instances: return isID ? "Instans & Node" : "Instances & Nodes"
        case .skills: return isID ? "Kemampuan Pintar" : "Skills & EvoLoop"
        case .cron: return isID ? "Otomasi & Jadwal" : "Automations & Cron"
        case .debug: return isID ? "Diagnostik & Debug" : "Debug & Diagnostics"
        case .about: return isID ? "Tentang CoreBlow" : "About CoreBlow"
        }
    }

    func localizedSubtitle(isID: Bool) -> String {
        switch self {
        case .general:
            return isID ? "Preferensi mode layanan, perizinan eksekusi, bahasa, dan opsi startup." : "Service mode, workspace permissions, language, and startup preferences."
        case .voiceWake:
            return isID ? "Aktivasi suara pintar, deteksi kata pemicu, dan model TTS Apple Silicon." : "Wake word detection, Apple Silicon MLX neural voice, and input settings."
        case .permissions:
            return isID ? "Izin akses berkas proyek, eksekusi terminal, dan kontrol privasi sistem." : "Workspace access, terminal execution approval, and system security."
        case .sessions:
            return isID ? "Penyimpanan database percakapan SQLite WAL dan pemadatan memori." : "Conversation history database, cache cleanup, and memory compaction."
        case .config:
            return isID ? "Kunci API penyedia (Anthropic, OpenAI, Gemini) dan proxy model lokal." : "Provider API keys, 9Router proxy, local Ollama, and JSON config."
        case .channels:
            return isID ? "Integrasi bot perpesanan ke WhatsApp, Telegram, Discord, Slack, dll." : "Connect AI bots to WhatsApp, Telegram, Discord, Slack, and messaging apps."
        case .instances:
            return isID ? "Pengaturan koneksi jarak jauh ke komputer lain dan node Windows." : "Remote multi-machine connections, Tailscale mesh, and node companions."
        case .skills:
            return isID ? "Modul kognitif mandiri SKILL.md dan penyempurnaan EvoLoop." : "Cognitive routines, distilled skills, and autonomous agent capabilities."
        case .cron:
            return isID ? "Otomasi terjadwal yang berjalan di latar belakang secara periodik." : "Autonomous recurring schedules, morning routines, and background triggers."
        case .debug:
            return isID ? "Inspeksi soket gateway, parser AST, dan pencatatan log sistem." : "Microkernel socket inspector, AST diagnostics, and developer logs."
        case .about:
            return isID ? "Informasi rilis CoreBlow v2.0 GA, pembaruan, dan lisensi resmi." : "CoreBlow release information, updater status, and documentation."
        }
    }

    var systemImage: String {
        switch self {
        case .general: return "gearshape"
        case .channels: return "bubble.left.and.bubble.right.fill"
        case .skills: return "sparkles"
        case .sessions: return "externaldrive.fill"
        case .cron: return "calendar.badge.clock"
        case .config: return "key.fill"
        case .instances: return "network"
        case .voiceWake: return "waveform"
        case .permissions: return "shield.checkerboard"
        case .debug: return "ant.fill"
        case .about: return "info.circle.fill"
        }
    }
}

// MARK: - Modern 2-Column Split Layout Settings View

struct SettingsRootView: View {
    @Bindable var state: AppState
    private let permissionMonitor = PermissionMonitor.shared
    @State private var monitoringPermissions = false
    @State private var selectedTab: SettingsTab = .general
    @State private var searchText: String = ""
    @State private var snapshotPaths: (configPath: String?, stateDir: String?) = (nil, nil)
    @AppStorage("coreblow.studio.language") private var studioLanguage: String = "ID"
    let updater: UpdaterProviding?
    private let isPreview = ProcessInfo.processInfo.isPreview
    private let isNixMode = ProcessInfo.processInfo.isNixMode

    private var isID: Bool { self.studioLanguage == "ID" }

    // Option 1 Zero-Fatigue Palette
    private let darkObsidian = Color(red: 5/255.0, green: 13/255.0, blue: 18/255.0)    // #050D12
    private let darkSlate = Color(red: 8/255.0, green: 23/255.0, blue: 28/255.0)       // #08171C
    private let deepMutedTeal = Color(red: 10/255.0, green: 36/255.0, blue: 41/255.0)  // #0A2429
    private let iceCyan = Color(red: 96/255.0, green: 217/255.0, blue: 204/255.0)      // #60D9CC

    init(state: AppState, updater: UpdaterProviding?, initialTab: SettingsTab? = nil) {
        self.state = state
        self.updater = updater
        self._selectedTab = State(initialValue: initialTab ?? .general)
    }

    var body: some View {
        HStack(spacing: 0) {
            // 1. Left Navigation Sidebar (240pt, #050D12 Dark Obsidian)
            self.settingsSidebar
                .frame(width: 240)
                .background(self.darkObsidian)

            // Vertical Hairline Divider (0.5pt)
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(width: 0.5)

            // 2. Right Content Canvas (Flexible, #08171C Dark Slate)
            self.settingsContentArea
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(self.darkSlate)
        }
        .frame(width: SettingsTab.windowWidth, height: SettingsTab.windowHeight)
        .background(
            ZStack {
                self.darkObsidian
                SettingsWindowAppearanceConfigurator()
            }
            .ignoresSafeArea()
        )
        .preferredColorScheme(.dark)
        .onReceive(NotificationCenter.default.publisher(for: .coreblowSelectSettingsTab)) { note in
            if let tab = note.object as? SettingsTab {
                withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
                    self.selectedTab = tab
                }
            }
        }
        .onAppear {
            if let pending = SettingsTabRouter.consumePending() {
                self.selectedTab = self.validTab(for: pending)
            }
            self.updatePermissionMonitoring(for: self.selectedTab)
        }
        .onChange(of: self.state.debugPaneEnabled) { _, enabled in
            if !enabled, self.selectedTab == .debug {
                self.selectedTab = .general
            }
        }
        .onChange(of: self.selectedTab) { _, newValue in
            self.updatePermissionMonitoring(for: newValue)
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            guard self.selectedTab == .permissions else { return }
            Task { await self.refreshPerms() }
        }
        .onDisappear { self.stopPermissionMonitoring() }
        .task {
            guard !self.isPreview else { return }
            await self.refreshPerms()
        }
        .task(id: self.state.connectionMode) {
            guard !self.isPreview else { return }
            await self.refreshSnapshotPaths()
        }
    }

    // MARK: - Left Navigation Sidebar

    private var settingsSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Sidebar Header (Title + Search Box)
            VStack(alignment: .leading, spacing: 10) {
                Text(self.isID ? "Pengaturan" : "Settings")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 4)

                // Search Filter Box
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.white.opacity(0.45))

                    TextField(self.isID ? "Cari pengaturan..." : "Search settings...", text: self.$searchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11.5))
                        .foregroundStyle(.white)

                    if !self.searchText.isEmpty {
                        Button(action: { self.searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.white.opacity(0.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(Color.white.opacity(0.045))
                        .overlay(
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                        )
                )
            }
            .padding(.horizontal, 14)
            .padding(.top, 18)
            .padding(.bottom, 12)

            // Scrollable Navigation List (Clustered)
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(StudioSettingsCluster.allCases) { cluster in
                        let items = self.filteredTabs(for: cluster)
                        if !items.isEmpty {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(cluster.localizedTitle(isID: self.isID))
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Color.white.opacity(0.42))
                                    .padding(.horizontal, 12)
                                    .padding(.bottom, 4)

                                ForEach(items, id: \.title) { tab in
                                    self.sidebarRow(for: tab)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
            }

            Spacer()

            // Sidebar Footer: Soft-Red Quit Button
            HStack {
                Button(action: { NSApp.terminate(nil) }) {
                    HStack(spacing: 6) {
                        Image(systemName: "power")
                            .font(.system(size: 11, weight: .semibold))
                        Text(self.isID ? "Keluar dari CoreBlow" : "Quit CoreBlow")
                            .font(.system(size: 11.5, weight: .medium))
                    }
                    .foregroundStyle(Color(red: 255/255.0, green: 110/255.0, blue: 110/255.0))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color(red: 255/255.0, green: 70/255.0, blue: 70/255.0).opacity(0.08))
                            .overlay(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(Color(red: 255/255.0, green: 70/255.0, blue: 70/255.0).opacity(0.2), lineWidth: 0.5)
                            )
                    )
                }
                .buttonStyle(.plain)

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
    }

    private func sidebarRow(for tab: SettingsTab) -> some View {
        let isSelected = self.selectedTab == tab
        return Button(action: {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.85)) {
                self.selectedTab = tab
            }
        }) {
            HStack(spacing: 9) {
                Image(systemName: tab.systemImage)
                    .font(.system(size: 12))
                    .foregroundStyle(isSelected ? self.iceCyan : Color.white.opacity(0.65))
                    .frame(width: 16)

                Text(tab.localizedTitle(isID: self.isID))
                    .font(.system(size: 12.5, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.white : Color.white.opacity(0.82))
                    .lineLimit(1)

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6.5)
            .background(
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(isSelected ? self.deepMutedTeal : Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .stroke(isSelected ? self.iceCyan.opacity(0.25) : Color.clear, lineWidth: 0.5)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private func filteredTabs(for cluster: StudioSettingsCluster) -> [SettingsTab] {
        var base: [SettingsTab] = []
        switch cluster {
        case .personal:
            base = [.general, .voiceWake, .permissions, .sessions]
        case .integrations:
            base = [.config, .channels, .instances]
        case .coding:
            base = [.skills, .cron]
            if self.state.debugPaneEnabled {
                base.append(.debug)
            }
            base.append(.about)
        }

        if self.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return base
        }

        let query = self.searchText.lowercased()
        return base.filter {
            $0.localizedTitle(isID: self.isID).lowercased().contains(query) ||
            $0.title.lowercased().contains(query)
        }
    }

    // MARK: - Right Content Canvas

    private var settingsContentArea: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header Bar (Large Title & Context Subtitle)
            VStack(alignment: .leading, spacing: 3) {
                Text(self.selectedTab.localizedTitle(isID: self.isID))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)

                Text(self.selectedTab.localizedSubtitle(isID: self.isID))
                    .font(.system(size: 11.5))
                    .foregroundStyle(Color.white.opacity(0.55))
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 12)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            // Child Content Area
            ZStack {
                if self.isNixMode {
                    VStack(alignment: .leading, spacing: 10) {
                        self.nixManagedBanner
                        self.selectedView
                    }
                } else {
                    self.selectedView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private var selectedView: some View {
        switch self.selectedTab {
        case .general:
            GeneralSettings(state: self.state)
        case .voiceWake:
            VoiceWakeSettings(state: self.state, isActive: self.selectedTab == .voiceWake)
        case .permissions:
            PermissionsSettings(
                status: self.permissionMonitor.status,
                refresh: self.refreshPerms,
                showOnboarding: { DebugActions.restartOnboarding() }
            )
        case .sessions:
            SessionsSettings()
        case .config:
            StudioAPIKeysAndConfigView(store: .shared)
        case .channels:
            ChannelsSettings()
        case .instances:
            InstancesSettings()
        case .skills:
            SkillsSettings(state: self.state)
        case .cron:
            CronSettings()
        case .debug:
            DebugSettings(state: self.state)
        case .about:
            AboutSettings(updater: self.updater)
        }
    }

    // MARK: - Helpers & Banner

    private var nixManagedBanner: some View {
        let configPath = self.snapshotPaths.configPath ?? CoreBlowPaths.configURL.path
        let stateDir = self.snapshotPaths.stateDir ?? CoreBlowPaths.stateDirURL.path

        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "gearshape.2.fill")
                    .foregroundStyle(.secondary)
                Text("Managed by Nix")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Config: \(configPath)")
                Text("State:  \(stateDir)")
            }
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
            .lineLimit(1)
            .truncationMode(.middle)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(Color.gray.opacity(0.12))
        .cornerRadius(10)
        .padding(.horizontal, 22)
        .padding(.top, 12)
    }

    private func validTab(for tab: SettingsTab) -> SettingsTab {
        if !self.state.debugPaneEnabled, tab == .debug {
            return .general
        }
        return tab
    }

    @MainActor
    private func refreshSnapshotPaths() async {
        self.snapshotPaths = await GatewayConnection.shared.snapshotPaths()
    }

    @MainActor
    private func refreshPerms() async {
        guard !self.isPreview else { return }
        await self.permissionMonitor.refreshNow()
    }

    private func updatePermissionMonitoring(for tab: SettingsTab) {
        guard !self.isPreview else { return }
        PermissionMonitoringSupport.setMonitoring(tab == .permissions, monitoring: &self.monitoringPermissions)
    }

    private func stopPermissionMonitoring() {
        PermissionMonitoringSupport.stopMonitoring(&self.monitoringPermissions)
    }
}

// MARK: - Router & Notification

@MainActor
enum SettingsTabRouter {
    private static var pending: SettingsTab?

    static func request(_ tab: SettingsTab) {
        self.pending = tab
    }

    static func consumePending() -> SettingsTab? {
        defer { self.pending = nil }
        return self.pending
    }
}

extension Notification.Name {
    static let coreblowSelectSettingsTab = Notification.Name("coreblowSelectSettingsTab")
}

private struct SettingsWindowAppearanceConfigurator: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            if let window = view.window {
                window.appearance = NSAppearance(named: .darkAqua)
                window.backgroundColor = NSColor(red: 5/255.0, green: 13/255.0, blue: 18/255.0, alpha: 1.0)
            }
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            if let window = nsView.window {
                window.appearance = NSAppearance(named: .darkAqua)
                window.backgroundColor = NSColor(red: 5/255.0, green: 13/255.0, blue: 18/255.0, alpha: 1.0)
            }
        }
    }
}

#if DEBUG
struct SettingsRootView_Previews: PreviewProvider {
    static var previews: some View {
        ForEach(SettingsTab.allCases, id: \.self) { tab in
            SettingsRootView(state: .preview, updater: DisabledUpdaterController(), initialTab: tab)
                .previewDisplayName(tab.title)
                .frame(width: SettingsTab.windowWidth, height: SettingsTab.windowHeight)
        }
    }
}
#endif
