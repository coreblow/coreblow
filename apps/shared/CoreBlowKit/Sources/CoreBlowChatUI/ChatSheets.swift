// CoreBlowChatUI/ChatSheets.swift
// Settings and configuration sheets for the chat interface.

import SwiftUI
import CoreBlowKit

/// Settings sheet for chat configuration.
public struct ChatSettingsSheet: View {
    @Bindable var viewModel: ChatViewModel
    @Environment(\.dismiss) private var dismiss

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Text("Settings")
                    .font(.headline)
                    .foregroundColor(viewModel.theme.assistantTextColor)
                Spacer()
                Button("Done") { dismiss() }
                    .foregroundColor(viewModel.theme.primaryColor)
            }
            .padding(.bottom, 4)

            // Connection info
            GroupBox {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Connection", systemImage: "wifi")
                        .font(.subheadline.bold())
                    HStack {
                        Text("Status:")
                        Spacer()
                        Text(connectionStatusText)
                            .foregroundColor(connectionColor)
                    }
                    .font(.system(size: 13))
                }
            }

            // Session info
            if let key = viewModel.sessionKey {
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Session", systemImage: "bubble.left.and.bubble.right")
                            .font(.subheadline.bold())
                        HStack {
                            Text("Key:")
                            Spacer()
                            Text(key.prefix(16))
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(viewModel.theme.mutedColor)
                        }
                        .font(.system(size: 13))

                        HStack {
                            Text("Messages:")
                            Spacer()
                            Text("\(viewModel.messages.count)")
                        }
                        .font(.system(size: 13))
                    }
                }
            }

            // Theme toggle
            GroupBox {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Appearance", systemImage: "paintbrush")
                        .font(.subheadline.bold())
                    HStack {
                        Text("Theme")
                        Spacer()
                        Button("Dark") { viewModel.theme = .dark }
                            .buttonStyle(.bordered)
                        Button("Light") { viewModel.theme = .light }
                            .buttonStyle(.bordered)
                    }
                    .font(.system(size: 13))
                }
            }

            Spacer()
        }
        .padding()
        .background(viewModel.theme.backgroundColor)
    }

    private var connectionStatusText: String {
        switch viewModel.connectionState {
        case .connected: return "Connected"
        case .connecting: return "Connecting..."
        case .disconnected: return "Disconnected"
        case .error(let msg): return "Error: \(msg)"
        }
    }

    private var connectionColor: Color {
        switch viewModel.connectionState {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .gray
        case .error: return viewModel.theme.errorColor
        }
    }
}
