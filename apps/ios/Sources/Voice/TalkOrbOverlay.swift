import SwiftUI

/// Animated talk orb overlay that responds to audio levels and talk state.
struct TalkOrbOverlay: View {
    let state: TalkModeManager.State
    let audioLevel: Float

    @State private var pulseScale: CGFloat = 1.0

    private var orbColor: Color {
        switch state {
        case .recording: return .red
        case .processing: return .purple
        case .speaking: return .blue
        case .error: return .orange
        case .inactive: return .gray.opacity(0.3)
        }
    }

    private var orbSize: CGFloat {
        switch state {
        case .recording: return 120 + CGFloat(audioLevel) * 200
        case .speaking: return 130
        default: return 100
        }
    }

    var body: some View {
        ZStack {
            // Outer pulse ring
            Circle()
                .fill(orbColor.opacity(0.15))
                .frame(width: orbSize + 40, height: orbSize + 40)
                .scaleEffect(pulseScale)

            // Inner orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [orbColor, orbColor.opacity(0.6)],
                        center: .center,
                        startRadius: 5,
                        endRadius: orbSize / 2
                    )
                )
                .frame(width: orbSize, height: orbSize)
                .shadow(color: orbColor.opacity(0.5), radius: 20)

            // State icon
            stateIcon
                .font(.system(size: 32, weight: .medium))
                .foregroundStyle(.white)
        }
        .animation(.easeInOut(duration: 0.15), value: audioLevel)
        .animation(.easeInOut(duration: 0.3), value: state)
        .onAppear { startPulse() }
    }

    @ViewBuilder
    private var stateIcon: some View {
        switch state {
        case .recording:
            Image(systemName: "waveform")
        case .processing:
            ProgressView()
                .tint(.white)
        case .speaking:
            Image(systemName: "speaker.wave.3.fill")
        case .error:
            Image(systemName: "exclamationmark.triangle")
        case .inactive:
            Image(systemName: "mic")
        }
    }

    private func startPulse() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = 1.08
        }
    }
}
