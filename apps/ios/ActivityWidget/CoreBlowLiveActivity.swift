import ActivityKit
import SwiftUI
import WidgetKit

struct CoreBlowActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var agentName: String
        var statusText: String
        var tokenCount: Int
        var isProcessing: Bool
    }

    var conversationId: String
    var providerName: String
}

struct CoreBlowLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CoreBlowActivityAttributes.self) { context in
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.agentName)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text(context.state.statusText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if context.state.isProcessing {
                    ProgressView()
                        .tint(.accentColor)
                } else {
                    Text("\(context.state.tokenCount) tokens")
                        .font(.caption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                }
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.agentName, systemImage: "brain.head.profile")
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.tokenCount)")
                        .font(.caption.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "brain.head.profile")
            } compactTrailing: {
                Text("\(context.state.tokenCount)")
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: "brain.head.profile")
            }
        }
    }
}
