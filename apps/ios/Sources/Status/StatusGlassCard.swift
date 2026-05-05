import SwiftUI

/// Frosted-glass status card showing gateway connection info.
struct StatusGlassCard: View {
    let statusText: String
    let serverName: String?
    let latencyMs: Double?
    let isConnected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Circle()
                    .fill(isConnected ? Color.green : Color.gray)
                    .frame(width: 10, height: 10)

                VStack(alignment: .leading, spacing: 2) {
                    Text(statusText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)

                    if let server = serverName {
                        Text(server)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                if let ms = latencyMs {
                    Text("\(Int(ms))ms")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}
