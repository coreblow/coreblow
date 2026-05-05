import SwiftUI
struct TalkOverlayView: View { let state: TalkModeState
    var body: some View { VStack { switch state { case .idle: Text("Press to talk"); case .listening: ProgressView("Listening…"); case .processing: ProgressView("Processing…"); case .speaking: Text("Speaking…"); case .error(let msg): Text(msg).foregroundStyle(.red) } }.padding().background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16)) }
}
