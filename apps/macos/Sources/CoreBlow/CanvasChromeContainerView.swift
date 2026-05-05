import SwiftUI
struct CanvasChromeContainerView: View {
    let sessionId: String; @State private var urlText = ""
    var body: some View { VStack(spacing: 0) { HStack { Image(systemName: "globe"); TextField("URL", text: $urlText).textFieldStyle(.roundedBorder) }.padding(8); Divider(); Color.clear }
    }
}
