import SwiftUI
struct ContextMenuCardView: View { let title: String; let subtitle: String?
    var body: some View { VStack(alignment: .leading) { Text(title).font(.headline); if let sub = subtitle { Text(sub).font(.caption).foregroundStyle(.secondary) } }.padding().background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8)) }
}
