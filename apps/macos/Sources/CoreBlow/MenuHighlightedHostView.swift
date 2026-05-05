import SwiftUI
struct MenuHighlightedHostView: View { let host: String; let isConnected: Bool
    var body: some View { HStack { Circle().fill(isConnected ? .green : .red).frame(width: 8, height: 8); Text(host).font(.system(.body, design: .monospaced)) } }
}
