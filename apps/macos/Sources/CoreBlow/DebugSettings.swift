import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Observation
import CoreBlowKit
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Debug Settings

struct DebugSettings: View {
    private let labelColumnWidth: CGFloat = 140

    @AppStorage("coreblow.debug.logLevel") private var logLevel: String = "info"
    @AppStorage("coreblow.debug.fileLogEnabled") private var fileLogEnabled: Bool = false
    @AppStorage("coreblow.debug.iconOverride") private var iconOverrideRaw: String = "system"
    @AppStorage("coreblow.debug.canvasEnabled") private var canvasEnabled: Bool = true
    @AppStorage("coreblow.debug.modelCatalogPath") private var modelCatalogPath: String = ""
    @AppStorage("coreblow.debug.modelCatalogReload") private var modelCatalogReloadBump: Int = 0

    @State private var gatewayLog: String = ""
    @State private var portCheckInFlight = false
    @State private var portReports: [PortReport] = []
    @State private var portKillStatus: String?
    @State private var debugSendInFlight = false
    @State private var debugSendStatus: String?
    @State private var debugSendError: String?
    @State private var pendingKillPID: Int32?
    @State private var showingKillConfirm = false
    @State private var launchAgentWriteDisabled = false
    @State private var launchAgentWriteError: String?
    @State private var gatewayRootInput: String = ""
    @State private var sessionStorePath: String = ""
    @State private var sessionStoreSaveError: String?
    @State private var modelsCount: Int?
    @State private var modelsLoading = false
    @State private var modelsError: String?
    @State private var tunnelResetInFlight = false
    @State private var tunnelResetStatus: String?

    @State private var canvasSessionKey: String = "main"
    @State private var canvasStatus: String?
    @State private var canvasError: String?
    @State private var canvasEvalJS: String = "document.title"
    @State private var canvasEvalResult: String?
    @State private var canvasSnapshotPath: String?

    struct PortReport: Identifiable {
        let id = UUID()
        let port: Int
        let summary: String
        let listeners: [PortListener]
    }

    struct PortListener: Identifiable {
        let id = UUID()
        let pid: Int32
        let command: String
        let fullCommand: String
        let expected: Bool
    }

    init(state _: AppState? = nil) {}

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 14) {
                header

                launchdSection
                appInfoSection
                gatewaySection
                logsSection
                portsSection
                pathsSection
                quickActionsSection
                canvasSection
                experimentsSection

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 18)
            .groupBoxStyle(PlainSettingsGroupBoxStyle())
        }
        .task {
            loadSessionStorePath()
            await reloadModels()
        }
        .alert("Kill process?", isPresented: $showingKillConfirm) {
            Button("Kill", role: .destructive) {
                if let pid = pendingKillPID {
                    kill(pid, SIGTERM)
                    portKillStatus = "Sent SIGTERM to \(pid)"
                    pendingKillPID = nil
                }
            }
            Button("Cancel", role: .cancel) { pendingKillPID = nil }
        } message: {
            Text("This process looks expected for the current mode. Kill anyway?")
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Debug")
                .font(.title3.weight(.semibold))
            Text("Tools for diagnosing local issues (Gateway, ports, logs).")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func gridLabel(_ text: String) -> some View {
        Text(text)
            .foregroundStyle(.secondary)
            .frame(width: labelColumnWidth, alignment: .leading)
    }

    // MARK: - App Info Section

    private var appInfoSection: some View {
        GroupBox("App") {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                GridRow {
                    gridLabel("Version")
                    Text("\(GatewayEnvironment.appVersion) (\(GatewayEnvironment.buildNumber))")
                        .font(.caption.monospaced())
                }
                GridRow {
                    gridLabel("PID")
                    Text("\(ProcessInfo.processInfo.processIdentifier)")
                }
                GridRow {
                    gridLabel("Binary path")
                    Text(Bundle.main.bundlePath)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                GridRow {
                    gridLabel("macOS")
                    Text(ProcessInfo.processInfo.operatingSystemVersionString)
                        .font(.caption.monospaced())
                }
            }
        }
    }

    // MARK: - Gateway Section

    private var gatewaySection: some View {
        GroupBox("Gateway") {
            VStack(alignment: .leading, spacing: 10) {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                    GridRow {
                        gridLabel("Status")
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("Connected")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Stdout / stderr")
                        .font(.caption.weight(.semibold))
                    ScrollView {
                        Text(gatewayLog.isEmpty ? "—" : gatewayLog)
                            .font(.caption.monospaced())
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .frame(height: 180)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.2)))

                    HStack(spacing: 8) {
                        Button("Restart Gateway") {
                            Task {
                                try? await GatewayConnection.shared.refresh()
                            }
                        }
                        Button("Clear log") {
                            gatewayLog = ""
                        }
                        Spacer(minLength: 0)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    // MARK: - Logs Section

    private var logsSection: some View {
        GroupBox("Logs") {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                GridRow {
                    gridLabel("Log directory")
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Button("Open") {
                                NSWorkspace.shared.open(CoreBlowPaths.logsDirectory)
                            }
                            .buttonStyle(.bordered)
                            Text(CoreBlowPaths.logsDirectory.path)
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                }

                GridRow {
                    gridLabel("App logging")
                    VStack(alignment: .leading, spacing: 8) {
                        Picker("Verbosity", selection: $logLevel) {
                            Text("Debug").tag("debug")
                            Text("Info").tag("info")
                            Text("Warning").tag("warning")
                            Text("Error").tag("error")
                        }
                        .pickerStyle(.menu)
                        .labelsHidden()

                        Toggle("Write rolling diagnostics log (JSONL)", isOn: $fileLogEnabled)
                            .toggleStyle(.checkbox)
                            .help("Writes a rotating, local-only log. Enable only while actively debugging.")
                    }
                }
            }
        }
    }

    // MARK: - Ports Section

    private var portsSection: some View {
        GroupBox("Ports") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("Port diagnostics")
                        .font(.caption.weight(.semibold))
                    if portCheckInFlight { ProgressView().controlSize(.small) }
                    Spacer()
                    Button("Check gateway ports") {
                        Task { await runPortCheck() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(portCheckInFlight)
                }

                if let portKillStatus {
                    Text(portKillStatus)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if portReports.isEmpty, !portCheckInFlight {
                    Text("Check which process owns the gateway port and suggest fixes.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(portReports) { report in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Port \(report.port)")
                                .font(.footnote.weight(.semibold))
                            Text(report.summary)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            ForEach(report.listeners) { listener in
                                HStack(spacing: 8) {
                                    Text("\(listener.command) (\(listener.pid))")
                                        .font(.caption.monospaced())
                                        .foregroundStyle(listener.expected ? .secondary : Color.red)
                                    Spacer()
                                    Button("Kill") {
                                        pendingKillPID = listener.pid
                                        kill(listener.pid, SIGTERM)
                                        portKillStatus = "Sent SIGTERM to \(listener.pid)"
                                    }
                                    .buttonStyle(.bordered)
                                }
                                .padding(6)
                                .background(Color.secondary.opacity(0.05))
                                .cornerRadius(4)
                            }
                        }
                        .padding(8)
                        .background(Color.secondary.opacity(0.08))
                        .cornerRadius(6)
                    }
                }
            }
        }
    }

    // MARK: - Paths Section

    private var pathsSection: some View {
        GroupBox("Paths") {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                GridRow {
                    gridLabel("App Support")
                    Text(CoreBlowPaths.applicationSupport.path)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                GridRow {
                    gridLabel("Config file")
                    Text(CoreBlowPaths.configFile.path)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                GridRow {
                    gridLabel("State dir")
                    Text(CoreBlowPaths.stateDirURL.path)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
        }
    }

    // MARK: - Quick Actions Section

    private var quickActionsSection: some View {
        GroupBox("Quick actions") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Button("Send Test Notification") {
                        Task { await sendTestNotification() }
                    }
                    .buttonStyle(.bordered)

                    Button("Copy Diagnostics") {
                        copyDiagnostics()
                    }
                    .buttonStyle(.bordered)

                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        Task { await sendVoiceDebug() }
                    } label: {
                        Label(
                            debugSendInFlight ? "Sending debug voice…" : "Send debug voice",
                            systemImage: debugSendInFlight ? "bolt.horizontal.circle" : "waveform")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(debugSendInFlight)

                    if let debugSendStatus {
                        Text(debugSendStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if let debugSendError {
                        Text(debugSendError)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                HStack(spacing: 8) {
                    Button("Restart app") { restartApp() }
                    Button("Reveal in Finder") {
                        NSWorkspace.shared.activateFileViewerSelecting([Bundle.main.bundleURL])
                    }
                    Spacer(minLength: 0)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Launchd Section

    private var launchdSection: some View {
        GroupBox("Gateway startup") {
            VStack(alignment: .leading, spacing: 8) {
                Toggle("Attach only (skip launchd install)", isOn: $launchAgentWriteDisabled)
                    .onChange(of: launchAgentWriteDisabled) { _, newValue in
                        if newValue {
                            launchAgentWriteError = nil
                        }
                    }

                Text(
                    "When enabled, CoreBlow won't install or manage the launchd agent. " +
                    "It will only attach to an existing Gateway.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let launchAgentWriteError {
                    Text(launchAgentWriteError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: - Canvas Section

    private var canvasSection: some View {
        GroupBox("Canvas") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Enable/disable Canvas in General settings.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    TextField("Session", text: $canvasSessionKey)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption.monospaced())
                        .frame(width: 160)
                    Button("Show panel") {
                        Task { await canvasPresent() }
                    }
                    .buttonStyle(.borderedProminent)
                    Button("Hide panel") {
                        CanvasManager.shared.hideAll()
                        canvasStatus = "hidden"
                        canvasError = nil
                    }
                    .buttonStyle(.bordered)
                    Button("Write sample page") {
                        Task { await canvasWriteSamplePage() }
                    }
                    .buttonStyle(.bordered)
                    Spacer(minLength: 0)
                }

                HStack(spacing: 8) {
                    TextField("Eval JS", text: $canvasEvalJS)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption.monospaced())
                        .frame(maxWidth: 520)
                    Button("Eval") {
                        Task { await canvasEval() }
                    }
                    .buttonStyle(.bordered)
                    Button("Snapshot") {
                        Task { await canvasSnapshot() }
                    }
                    .buttonStyle(.bordered)
                    Spacer(minLength: 0)
                }

                if let canvasStatus {
                    Text(canvasStatus)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
                if let canvasEvalResult {
                    Text("eval → \(canvasEvalResult)")
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .truncationMode(.middle)
                        .textSelection(.enabled)
                }
                if let canvasSnapshotPath {
                    HStack(spacing: 8) {
                        Text("snapshot → \(canvasSnapshotPath)")
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .textSelection(.enabled)
                        Button("Reveal") {
                            NSWorkspace.shared
                                .activateFileViewerSelecting([URL(fileURLWithPath: canvasSnapshotPath)])
                        }
                        .buttonStyle(.bordered)
                        Spacer(minLength: 0)
                    }
                }
                if let canvasError {
                    Text(canvasError)
                        .font(.caption2)
                        .foregroundStyle(.red)
                } else {
                    Text("Tip: the session directory is returned by \"Show panel\".")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: - Experiments Section

    private var experimentsSection: some View {
        GroupBox("Experiments") {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 10) {
                GridRow {
                    gridLabel("Icon override")
                    Picker("", selection: $iconOverrideRaw) {
                        Text("System").tag("system")
                        Text("Dark").tag("dark")
                        Text("Light").tag("light")
                        Text("Monochrome").tag("mono")
                    }
                    .labelsHidden()
                    .frame(maxWidth: 280, alignment: .leading)
                }
                GridRow {
                    gridLabel("Chat mode")
                    Text("Native SwiftUI")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Actions

    @MainActor
    private func runPortCheck() async {
        portCheckInFlight = true
        portKillStatus = nil
        try? await Task.sleep(nanoseconds: 500_000_000)
        portReports = []
        portCheckInFlight = false
    }

    @MainActor
    private func resetGatewayTunnel() async {
        tunnelResetInFlight = true
        tunnelResetStatus = nil
        try? await Task.sleep(nanoseconds: 300_000_000)
        tunnelResetStatus = "Tunnel reset complete"
        await runPortCheck()
        tunnelResetInFlight = false
    }

    private func requestKill(_ listener: PortListener) {
        if listener.expected {
            pendingKillPID = listener.pid
            showingKillConfirm = true
        } else {
            kill(listener.pid, SIGTERM)
            portKillStatus = "Sent SIGTERM to \(listener.pid)"
        }
    }

    private func copyDiagnostics() {
        let info = """
        CoreBlow \(GatewayEnvironment.appVersion) (\(GatewayEnvironment.buildNumber))
        macOS \(ProcessInfo.processInfo.operatingSystemVersionString)
        PID: \(ProcessInfo.processInfo.processIdentifier)
        Bundle: \(Bundle.main.bundlePath)
        """
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(info, forType: .string)
    }

    private func sendTestNotification() async {
        let content = UNMutableNotificationContent()
        content.title = "CoreBlow Test"
        content.body = "This is a test notification from CoreBlow."
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }

    private func sendVoiceDebug() async {
        await MainActor.run {
            debugSendInFlight = true
            debugSendError = nil
            debugSendStatus = nil
        }
        let result = await GatewayConnection.shared.sendAgent(
            message: "Hello from debug voice",
            thinking: "default",
            sessionKey: "main",
            deliver: false,
            to: nil)
        await MainActor.run {
            debugSendInFlight = false
            if result.ok {
                debugSendStatus = "Voice debug sent successfully"
            } else {
                debugSendError = result.error ?? "Unknown error"
            }
        }
    }

    private func restartApp() {
        let url = Bundle.main.bundleURL
        let config = NSWorkspace.OpenConfiguration()
        config.createsNewApplicationInstance = true
        NSWorkspace.shared.openApplication(at: url, configuration: config) { _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                NSApp.terminate(nil)
            }
        }
    }

    private func revealApp() {
        NSWorkspace.shared.activateFileViewerSelecting([Bundle.main.bundleURL])
    }

    // MARK: - Model Catalog

    private func chooseCatalogFile() {
        let panel = NSOpenPanel()
        panel.title = "Select models.generated.ts"
        let tsType = UTType(filenameExtension: "ts")
            ?? UTType(tag: "ts", tagClass: .filenameExtension, conformingTo: .sourceCode)
            ?? .item
        panel.allowedContentTypes = [tsType]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            modelCatalogPath = url.path
            modelCatalogReloadBump += 1
            Task { await reloadModels() }
        }
    }

    private func reloadModels() async {
        guard !modelsLoading else { return }
        modelsLoading = true
        modelsError = nil
        modelCatalogReloadBump += 1
        defer { modelsLoading = false }
        do {
            let loaded = try await ModelCatalogLoader.load(from: modelCatalogPath)
            modelsCount = loaded.count
        } catch {
            modelsCount = nil
            modelsError = error.localizedDescription
        }
    }

    // MARK: - Session Store Path

    private func loadSessionStorePath() {
        let parsed = CoreBlowConfigFile.loadDict()
        guard
            let session = parsed["session"] as? [String: Any],
            let path = session["store"] as? String
        else {
            sessionStorePath = ""
            return
        }
        sessionStorePath = path
    }

    private func saveSessionStorePath() {
        let trimmed = sessionStorePath.trimmingCharacters(in: .whitespacesAndNewlines)
        var root = CoreBlowConfigFile.loadDict()
        var session = root["session"] as? [String: Any] ?? [:]
        session["store"] = trimmed.isEmpty ? nil : trimmed
        root["session"] = session
        CoreBlowConfigFile.saveDict(root)
        sessionStoreSaveError = nil
    }
}

// MARK: - Canvas Debug Actions

extension DebugSettings {
    @MainActor
    private func canvasPresent() async {
        canvasError = nil
        let session = canvasSessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let dir = try CanvasManager.shared.show(sessionKey: session.isEmpty ? "main" : session, path: "/")
            canvasStatus = "dir: \(dir)"
        } catch {
            canvasError = error.localizedDescription
        }
    }

    @MainActor
    private func canvasWriteSamplePage() async {
        canvasError = nil
        let session = canvasSessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let dir = try CanvasManager.shared.show(sessionKey: session.isEmpty ? "main" : session, path: "/")
            let url = URL(fileURLWithPath: dir).appendingPathComponent("index.html", isDirectory: false)
            let now = ISO8601DateFormatter().string(from: Date())
            let html = """
            <!doctype html>
            <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Canvas Debug</title>
                <style>
                  :root { color-scheme: dark; }
                  html,body { height:100%; margin:0; background:#0b1020; color:#e5e7eb; }
                  body { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
                  .wrap { padding:16px; }
                  .row { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
                  .pill { padding:6px 10px; border-radius:999px; background:rgba(255,255,255,.08);
                          border:1px solid rgba(255,255,255,.12); }
                  button { background:#22c55e; color:#04110a; border:0; border-radius:10px;
                           padding:8px 10px; font-weight:700; cursor:pointer; }
                  button:active { transform: translateY(1px); }
                  .panel { margin-top:14px; padding:14px; border-radius:14px; background:rgba(255,255,255,.06);
                           border:1px solid rgba(255,255,255,.1); }
                  .grid { display:grid; grid-template-columns: repeat(12, 1fr); gap:10px; margin-top:12px; }
                  .box { grid-column: span 4; height:80px; border-radius:14px;
                         background: linear-gradient(135deg, rgba(59,130,246,.35), rgba(168,85,247,.25));
                         border:1px solid rgba(255,255,255,.12); }
                  .muted { color: rgba(229,231,235,.7); }
                </style>
              </head>
              <body>
                <div class="wrap">
                  <div class="row">
                    <div class="pill">Canvas Debug</div>
                    <div class="pill muted">generated: \(now)</div>
                    <div class="pill muted">userAgent: <span id="ua"></span></div>
                    <button id="btn">Click me</button>
                    <div class="pill">count: <span id="count">0</span></div>
                  </div>
                  <div class="panel">
                    <div class="muted">This is a local file served by the WKURLSchemeHandler.</div>
                    <div class="grid">
                      <div class="box"></div><div class="box"></div><div class="box"></div>
                      <div class="box"></div><div class="box"></div><div class="box"></div>
                    </div>
                  </div>
                </div>
                <script>
                  document.getElementById('ua').textContent = navigator.userAgent;
                  let n = 0;
                  document.getElementById('btn').addEventListener('click', () => {
                    n++;
                    document.getElementById('count').textContent = String(n);
                    document.title = 'Canvas Debug (' + n + ')';
                  });
                </script>
              </body>
            </html>
            """
            try html.write(to: url, atomically: true, encoding: .utf8)
            canvasStatus = "wrote: \(url.path)"
            _ = try CanvasManager.shared.show(sessionKey: session.isEmpty ? "main" : session, path: "/")
        } catch {
            canvasError = error.localizedDescription
        }
    }

    @MainActor
    private func canvasEval() async {
        canvasError = nil
        canvasEvalResult = nil
        do {
            let session = canvasSessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
            let result = try await CanvasManager.shared.eval(
                sessionKey: session.isEmpty ? "main" : session,
                javaScript: canvasEvalJS)
            canvasEvalResult = result
        } catch {
            canvasError = error.localizedDescription
        }
    }

    @MainActor
    private func canvasSnapshot() async {
        canvasError = nil
        canvasSnapshotPath = nil
        do {
            let session = canvasSessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
            let path = try await CanvasManager.shared.snapshot(
                sessionKey: session.isEmpty ? "main" : session,
                outPath: nil)
            canvasSnapshotPath = path
        } catch {
            canvasError = error.localizedDescription
        }
    }
}

// MARK: - Plain Settings Group Box Style

struct PlainSettingsGroupBoxStyle: GroupBoxStyle {
    func makeBody(configuration: Configuration) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            configuration.label
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            configuration.content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - DEBUG Testing Hooks

#if DEBUG
extension DebugSettings {
    @MainActor
    static func exerciseForTesting() async {
        var view = DebugSettings()
        view.modelsCount = 3
        view.modelsLoading = false
        view.modelsError = "Failed to load models"
        view.gatewayRootInput = "/tmp/coreblow"
        view.sessionStorePath = "/tmp/sessions.json"
        view.sessionStoreSaveError = "Save failed"
        view.debugSendInFlight = true
        view.debugSendStatus = "Sent"
        view.debugSendError = "Failed"
        view.portCheckInFlight = true
        view.portReports = []
        view.portKillStatus = "Killed"
        view.canvasSessionKey = "main"
        view.canvasStatus = "Canvas ok"
        view.canvasError = "Canvas error"
        view.canvasEvalJS = "document.title"
        view.canvasEvalResult = "Canvas"
        view.canvasSnapshotPath = "/tmp/snapshot.png"

        _ = view.body
        _ = view.header
        _ = view.appInfoSection
        _ = view.gatewaySection
        _ = view.logsSection
        _ = view.portsSection
        _ = view.pathsSection
        _ = view.quickActionsSection
        _ = view.canvasSection
        _ = view.experimentsSection
        _ = view.gridLabel("Test")

        view.loadSessionStorePath()
        await view.reloadModels()
    }
}
#endif

import UserNotifications
