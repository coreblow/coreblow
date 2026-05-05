import SwiftUI
struct ChatMessageBubble: View { let message: ChatMessage
    var body: some View { HStack { if message.role == .user { Spacer() }; VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 2) { Text(message.content).padding(10).background(message.role == .user ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 12)); Text(message.timestamp, style: .time).font(.caption2).foregroundStyle(.tertiary) }; if message.role != .user { Spacer() } } }
}
