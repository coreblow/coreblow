import SwiftUI

struct WatchChatView: View {
    @State private var inputText = ""
    @State private var messages: [WatchMessage] = []

    var body: some View {
        VStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(messages) { message in
                        WatchMessageBubble(message: message)
                    }
                }
                .padding(.horizontal, 4)
            }

            HStack {
                TextField("Ask...", text: $inputText)
                    .textFieldStyle(.plain)

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                }
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Chat")
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        messages.append(WatchMessage(id: UUID(), content: text, isUser: true))
        inputText = ""
    }
}

struct WatchMessageBubble: View {
    let message: WatchMessage

    var body: some View {
        Text(message.content)
            .font(.caption2)
            .padding(6)
            .background(message.isUser ? Color.accentColor.opacity(0.3) : Color.gray.opacity(0.2))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .frame(maxWidth: .infinity, alignment: message.isUser ? .trailing : .leading)
    }
}

struct WatchMessage: Identifiable {
    let id: UUID
    let content: String
    let isUser: Bool
}

struct WatchRecentView: View {
    var body: some View {
        List {
            Text("No recent conversations")
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Recent")
    }
}

struct WatchStatusView: View {
    var body: some View {
        List {
            LabeledContent("Agent", value: "Idle")
            LabeledContent("Provider", value: "--")
            LabeledContent("Uptime", value: "--")
        }
        .navigationTitle("Status")
    }
}
