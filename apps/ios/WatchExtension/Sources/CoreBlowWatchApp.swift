import SwiftUI

@main
struct CoreBlowWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchHomeView()
        }
    }
}

struct WatchHomeView: View {
    @State private var connectionStatus: ConnectionStatus = .disconnected

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Circle()
                            .fill(connectionStatus.color)
                            .frame(width: 8, height: 8)
                        Text(connectionStatus.label)
                            .font(.caption)
                    }
                }

                Section("Quick Actions") {
                    NavigationLink("New Chat") {
                        WatchChatView()
                    }
                    NavigationLink("Recent") {
                        WatchRecentView()
                    }
                }

                Section("Status") {
                    NavigationLink("Agent Status") {
                        WatchStatusView()
                    }
                }
            }
            .navigationTitle("CoreBlow")
        }
    }
}

enum ConnectionStatus {
    case connected, connecting, disconnected

    var label: String {
        switch self {
        case .connected: "Connected"
        case .connecting: "Connecting..."
        case .disconnected: "Disconnected"
        }
    }

    var color: Color {
        switch self {
        case .connected: .green
        case .connecting: .orange
        case .disconnected: .red
        }
    }
}
