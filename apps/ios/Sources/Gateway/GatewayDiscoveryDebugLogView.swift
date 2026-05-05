import SwiftUI
import os.log

/// Debug log view showing gateway discovery events in real-time.
struct GatewayDiscoveryDebugLogView: View {
    @ObservedObject var model: GatewayDiscoveryModel

    var body: some View {
        NavigationStack {
            List {
                if model.logEntries.isEmpty {
                    Text("No discovery events yet. Tap Scan to start.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(model.logEntries) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Circle()
                                    .fill(entry.level.color)
                                    .frame(width: 8, height: 8)
                                Text(entry.timestamp, style: .time)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Text(entry.message)
                                .font(.caption)
                                .fontDesign(.monospaced)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .navigationTitle("Discovery Log")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Clear") { model.clearLog() }
                }
            }
        }
    }
}
