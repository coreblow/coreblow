import SwiftUI
struct DebugSettings: View { @State private var logLevel = "info"
    var body: some View { Form { Section("Diagnostics") { Picker("Log Level", selection: $logLevel) { Text("Debug").tag("debug"); Text("Info").tag("info"); Text("Warning").tag("warning") }; Button("Open Log Directory") { NSWorkspace.shared.open(CoreBlowPaths.logsDirectory) }; Button("Copy Diagnostics") { copyDiagnostics() } }; Section("Actions") { DebugActions() } }.formStyle(.grouped) }
    private func copyDiagnostics() { let info = "CoreBlow \(GatewayEnvironment.appVersion) (\(GatewayEnvironment.buildNumber))\nmacOS \(ProcessInfo.processInfo.operatingSystemVersionString)"; NSPasteboard.general.clearContents(); NSPasteboard.general.setString(info, forType: .string) }
}
