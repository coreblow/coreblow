import SwiftUI

/// Compact pill showing connection status with tint and icon.
struct StatusPill: View {
    let text: String
    let isConnected: Bool
    let showIcon: Bool

    init(text: String, isConnected: Bool, showIcon: Bool = true) {
        self.text = text
        self.isConnected = isConnected
        self.showIcon = showIcon
    }

    var body: some View {
        HStack(spacing: 4) {
            if showIcon {
                Image(systemName: isConnected ? "bolt.fill" : "bolt.slash")
                    .font(.caption2)
            }
            Text(text)
                .font(.caption2.weight(.medium))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(pillColor.opacity(0.15), in: Capsule())
        .foregroundStyle(pillColor)
    }

    private var pillColor: Color {
        isConnected ? .green : .gray
    }
}
