import SwiftUI
struct MenuHeaderCard: View {
    @State private var appState = AppState.shared
    var body: some View { HStack { VStack(alignment: .leading, spacing: 2) { Text("CoreBlow").font(.headline); Text(appState.isGatewayConnected ? "Connected" : "Offline").font(.caption).foregroundStyle(appState.isGatewayConnected ? .green : .secondary) }; Spacer(); StatusPill(connected: appState.isGatewayConnected) }.padding() }
}
