import SwiftUI
struct VoiceWakeOverlayView: View { let text: String; let isListening: Bool
    var body: some View { HStack(spacing: 8) { if isListening { ProgressView().scaleEffect(0.7) }; Text(text).font(.system(.body, design: .rounded)) }.padding(12).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12)) }
}
