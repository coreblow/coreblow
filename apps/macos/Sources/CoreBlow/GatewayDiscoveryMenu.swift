import SwiftUI
struct GatewayDiscoveryMenu: View { @State private var isScanning = false
    var body: some View { VStack { HStack { Text("Gateways").font(.headline); Spacer(); Button(isScanning ? "Stop" : "Scan") { isScanning.toggle() } }; if isScanning { ProgressView("Scanning…") } }.padding() }
}
