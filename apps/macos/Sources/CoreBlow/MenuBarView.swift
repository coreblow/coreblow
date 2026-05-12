import SwiftUI
import OSLog
import CoreBlowKit
import OSLog

struct MenuBarView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "brain.head.profile")
                    .foregroundStyle(.blue)
                Text("CoreBlow")
                    .font(.headline)
                Spacer()
                Circle()
                    .fill(appState.isGatewayConnected ? .green : .red)
                    .frame(width: 8, height: 8)
            }

            Divider()

            Button("Settings…") {
                SettingsTabRouter.open(tab: .general)
            }
            .keyboardShortcut(",")

            Divider()

            Button("Quit CoreBlow") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
        .padding(12)
        .frame(width: 240)
    }
}
