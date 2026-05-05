import SwiftUI

/// Alert shown when a deep link triggers an agent action requiring user confirmation.
struct DeepLinkAgentPromptAlert: View {
    let agentName: String
    let action: String
    let deepLinkURL: String
    let onAllow: () -> Void
    let onDeny: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "link.badge.plus")
                .font(.system(size: 44))
                .foregroundStyle(.blue)

            Text("Agent Action Request")
                .font(.headline)

            Text("**\(agentName)** wants to execute:")
                .font(.body)

            Text(action)
                .font(.callout)
                .fontDesign(.monospaced)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))

            Text("Source: \(deepLinkURL)")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)

            HStack(spacing: 16) {
                Button("Deny", role: .destructive) { onDeny() }
                    .buttonStyle(.bordered)
                Button("Allow") { onAllow() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
}
