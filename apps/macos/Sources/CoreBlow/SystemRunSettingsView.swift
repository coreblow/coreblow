import SwiftUI
struct SystemRunSettingsView: View {
    var body: some View { Form { Section("Execution Policy") { Text("Configure which commands can run without approval").font(.caption) }; Section("Allowlist") { Text(ExecAllowlistMatcher.defaultPatterns.joined(separator: ", ")).font(.system(.caption, design: .monospaced)) } }.formStyle(.grouped) }
}
