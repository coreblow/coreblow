import SwiftUI
struct StatusPill: View { let connected: Bool
    var body: some View { Text(connected ? "Connected" : "Offline").font(.caption2.bold()).padding(.horizontal, 8).padding(.vertical, 2).background(connected ? Color.green.opacity(0.2) : Color.gray.opacity(0.2), in: Capsule()).foregroundStyle(connected ? .green : .secondary) }
}
