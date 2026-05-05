import SwiftUI

/// Voice tab view with talk orb, wake controls, and transcript display.
struct VoiceTab: View {
    @ObservedObject var talkManager: TalkModeManager
    @ObservedObject var wakeManager: VoiceWakeManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Orb
                TalkOrbOverlay(
                    state: talkManager.state,
                    audioLevel: talkManager.audioLevel
                )

                // Status label
                Text(statusLabel)
                    .font(.title3)
                    .foregroundStyle(.secondary)

                // Transcript
                if !talkManager.lastTranscript.isEmpty {
                    Text(talkManager.lastTranscript)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 24)
                        .multilineTextAlignment(.center)
                        .transition(.opacity)
                }

                Spacer()

                // Controls
                HStack(spacing: 24) {
                    // Talk button
                    Button {
                        if talkManager.state == .recording {
                            talkManager.stopRecording()
                        } else {
                            talkManager.startRecording()
                        }
                    } label: {
                        Label(
                            talkManager.state == .recording ? "Stop" : "Talk",
                            systemImage: talkManager.state == .recording ? "stop.circle" : "mic.circle"
                        )
                        .font(.headline)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(talkManager.state == .recording ? .red : .blue)

                    // Wake toggle
                    Button {
                        if wakeManager.state == .listening {
                            wakeManager.stopListening()
                        } else {
                            wakeManager.startListening()
                        }
                    } label: {
                        Label(
                            wakeManager.state == .listening ? "Wake Off" : "Wake On",
                            systemImage: wakeManager.state == .listening ? "ear.fill" : "ear"
                        )
                        .font(.headline)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.bottom, 32)
            }
            .navigationTitle("Voice")
        }
    }

    private var statusLabel: String {
        switch talkManager.state {
        case .inactive:
            return wakeManager.state == .listening ? "Listening for wake word..." : "Tap Talk to start"
        case .recording: return "Recording..."
        case .processing: return "Processing..."
        case .speaking: return "Speaking..."
        case .error: return "Error occurred"
        }
    }
}
