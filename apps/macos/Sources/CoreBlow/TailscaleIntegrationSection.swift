import SwiftUI
struct TailscaleIntegrationSection: View { @State private var installed = false
    var body: some View { Section("Tailscale") { HStack { Text("Tailscale"); Spacer(); Text(installed ? "Installed" : "Not Found").foregroundStyle(installed ? .green : .secondary) } }.onAppear { installed = TailscaleService.isInstalled() } }
}
