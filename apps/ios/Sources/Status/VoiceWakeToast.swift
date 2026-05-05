import SwiftUI

/// Transient toast notification shown when a voice wake word is detected.
struct VoiceWakeToast: View {
    let text: String
    let isVisible: Bool

    var body: some View {
        if isVisible {
            HStack(spacing: 8) {
                Image(systemName: "ear.fill")
                    .font(.body)
                    .foregroundStyle(.white)
                Text(text)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.blue.gradient, in: Capsule())
            .shadow(color: .blue.opacity(0.3), radius: 8, y: 4)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}
