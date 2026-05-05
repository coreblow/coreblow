import SwiftUI

/// Full-screen chat sheet connected to the gateway operator session.
struct ChatSheet: View {
    @Bindable var model: NodeAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var inputText = ""
    @State private var messages: [ChatMessage] = []

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(messages) { message in
                                ChatBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) {
                        if let last = messages.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }

                Divider()

                HStack(spacing: 12) {
                    TextField("Message…", text: $inputText)
                        .textFieldStyle(.roundedBorder)

                    Button {
                        sendMessage()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding()
            }
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let msg = ChatMessage(id: UUID().uuidString, role: .user, content: text, timestamp: Date())
        messages.append(msg)
        inputText = ""
    }
}

// MARK: - Supporting Types

struct ChatMessage: Identifiable {
    let id: String
    let role: Role
    let content: String
    let timestamp: Date

    enum Role { case user, assistant, system }
}

private struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            Text(message.content)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    message.role == .user
                        ? Color.blue.opacity(0.85)
                        : Color(.systemGray5),
                    in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(message.role == .user ? .white : .primary)
            if message.role != .user { Spacer() }
        }
    }
}
