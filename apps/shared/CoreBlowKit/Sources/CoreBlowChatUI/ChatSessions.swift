// CoreBlowChatUI/ChatSessions.swift
// Session list management for the chat interface.

import SwiftUI
import CoreBlowKit

/// View for displaying and managing chat sessions.
public struct ChatSessionsView: View {
    @Bindable var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Sessions")
                    .font(.headline)
                    .foregroundColor(viewModel.theme.assistantTextColor)
                Spacer()
                Button("New") {
                    viewModel.newSession()
                    dismiss()
                }
                .foregroundColor(viewModel.theme.primaryColor)
            }
            .padding()
            .background(viewModel.theme.surfaceColor)

            // Session list
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(viewModel.sessions, id: \.key) { session in
                        sessionRow(session)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
        }
        .background(viewModel.theme.backgroundColor)
        .task { await viewModel.loadSessions() }
    }

    private func sessionRow(_ session: SessionPreviewEntry) -> some View {
        Button {
            Task {
                await viewModel.selectSession(session.key)
                dismiss()
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(session.key.prefix(12))
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(viewModel.theme.accentColor)
                    Spacer()
                    Text(session.status)
                        .font(.caption2)
                        .foregroundColor(viewModel.theme.mutedColor)
                }

                if let first = session.items.first {
                    Text(first.text)
                        .font(.system(size: 13))
                        .foregroundColor(viewModel.theme.assistantTextColor)
                        .lineLimit(2)
                }
            }
            .padding(10)
            .background(
                viewModel.sessionKey == session.key
                ? viewModel.theme.primaryColor.opacity(0.15)
                : viewModel.theme.surfaceColor
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}
