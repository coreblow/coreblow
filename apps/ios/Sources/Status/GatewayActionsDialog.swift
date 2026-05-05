import SwiftUI

/// Dialog presenting gateway actions: disconnect, reconnect, debug log, etc.
struct GatewayActionsDialog: View {
    let gatewayName: String?
    let isConnected: Bool
    let onDisconnect: () -> Void
    let onReconnect: () -> Void
    let onShowDebugLog: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Connection") {
                    if isConnected {
                        Button(role: .destructive) {
                            onDisconnect()
                            dismiss()
                        } label: {
                            Label("Disconnect", systemImage: "bolt.slash")
                        }
                    } else {
                        Button {
                            onReconnect()
                            dismiss()
                        } label: {
                            Label("Reconnect", systemImage: "bolt")
                        }
                    }
                }

                Section("Diagnostics") {
                    Button {
                        onShowDebugLog()
                        dismiss()
                    } label: {
                        Label("Discovery Log", systemImage: "doc.text.magnifyingglass")
                    }
                }
            }
            .navigationTitle(gatewayName ?? "Gateway")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
