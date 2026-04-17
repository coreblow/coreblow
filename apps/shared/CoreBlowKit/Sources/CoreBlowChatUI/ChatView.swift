// CoreBlowChatUI/ChatView.swift
// Main SwiftUI chat interface for CoreBlow.

import SwiftUI
import CoreBlowKit
import CoreBlowProtocol

/// The main chat view for CoreBlow.
public struct ChatView: View {
    @Bindable var viewModel: ChatViewModel

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            chatHeader

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: viewModel.theme.messageSpacing) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message, theme: viewModel.theme)
                                .id(message.id)
                        }

                        // Streaming indicator
                        if viewModel.isStreaming {
                            streamingIndicator
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            // Composer
            ChatComposer(viewModel: viewModel)
        }
        .background(viewModel.theme.backgroundColor)
    }

    // MARK: - Header

    private var chatHeader: some View {
        HStack {
            // Connection indicator
            Circle()
                .fill(connectionColor)
                .frame(width: 8, height: 8)

            if let emoji = viewModel.agentEmoji {
                Text(emoji).font(.title3)
            }

            Text(viewModel.agentName ?? "CoreBlow")
                .font(.headline)
                .foregroundColor(viewModel.theme.assistantTextColor)

            Spacer()

            // Session info
            if let key = viewModel.sessionKey {
                Text(key.prefix(8))
                    .font(.caption)
                    .foregroundColor(viewModel.theme.mutedColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(viewModel.theme.surfaceColor)
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .gray
        case .error: return viewModel.theme.errorColor
        }
    }

    // MARK: - Streaming Indicator

    private var streamingIndicator: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                if !viewModel.streamingText.isEmpty {
                    Text(viewModel.streamingText)
                        .font(.system(size: viewModel.theme.messageFontSize))
                        .foregroundColor(viewModel.theme.assistantTextColor)
                }

                // Tool calls in progress
                ForEach(viewModel.pendingToolCalls) { tool in
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.small)
                        Text(tool.name)
                            .font(.system(size: viewModel.theme.toolCallFontSize, design: .monospaced))
                            .foregroundColor(viewModel.theme.accentColor)
                    }
                }

                if viewModel.streamingText.isEmpty && viewModel.pendingToolCalls.isEmpty {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.small)
                        Text("Thinking...")
                            .font(.system(size: viewModel.theme.messageFontSize))
                            .foregroundColor(viewModel.theme.mutedColor)
                    }
                }
            }
            Spacer()
        }
        .padding(viewModel.theme.bubblePadding)
        .background(viewModel.theme.assistantBubbleColor)
        .clipShape(RoundedRectangle(cornerRadius: viewModel.theme.bubbleCornerRadius))
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    let theme: ChatTheme

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 60) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                // Content blocks
                ForEach(Array(message.content.enumerated()), id: \.offset) { _, content in
                    if let text = content.displayText, !text.isEmpty {
                        Text(text)
                            .font(.system(size: theme.messageFontSize))
                            .foregroundColor(message.isUser ? theme.userTextColor : theme.assistantTextColor)
                            .textSelection(.enabled)
                    }

                    if content.isToolCall, let name = content.name {
                        HStack(spacing: 4) {
                            Image(systemName: "wrench.fill")
                                .font(.system(size: 10))
                            Text(name)
                                .font(.system(size: theme.toolCallFontSize, design: .monospaced))
                        }
                        .foregroundColor(theme.accentColor)
                        .padding(.vertical, 2)
                    }
                }

                // Timestamp
                if let ts = message.timestamp {
                    Text(formatTimestamp(ts))
                        .font(.system(size: theme.timestampFontSize))
                        .foregroundColor(theme.mutedColor)
                }
            }
            .padding(theme.bubblePadding)
            .background(message.isUser ? theme.userBubbleColor : theme.assistantBubbleColor)
            .clipShape(RoundedRectangle(cornerRadius: theme.bubbleCornerRadius))

            if !message.isUser { Spacer(minLength: 60) }
        }
    }

    private func formatTimestamp(_ ts: Double) -> String {
        let date = Date(timeIntervalSince1970: ts)
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: date)
    }
}

// MARK: - Chat Composer

struct ChatComposer: View {
    @Bindable var viewModel: ChatViewModel

    var body: some View {
        HStack(spacing: 10) {
            TextField("Message CoreBlow...", text: $viewModel.composerText, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: viewModel.theme.messageFontSize))
                .foregroundColor(viewModel.theme.assistantTextColor)
                .lineLimit(1...5)
                .onSubmit { Task { await viewModel.send() } }

            if viewModel.isStreaming {
                Button(action: { Task { await viewModel.abort() } }) {
                    Image(systemName: "stop.circle.fill")
                        .font(.title2)
                        .foregroundColor(viewModel.theme.errorColor)
                }
                .buttonStyle(.plain)
            } else {
                Button(action: { Task { await viewModel.send() } }) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(
                            viewModel.composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? viewModel.theme.mutedColor
                            : viewModel.theme.primaryColor
                        )
                }
                .buttonStyle(.plain)
                .disabled(viewModel.composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(viewModel.theme.surfaceColor)
        .clipShape(RoundedRectangle(cornerRadius: viewModel.theme.composerCornerRadius))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}
