import SwiftUI
struct SessionMenuLabelView: View { let session: SessionData
    var body: some View { HStack { Image(systemName: "bubble.left.fill").foregroundStyle(.tint); VStack(alignment: .leading) { Text(session.displayName).lineLimit(1); Text("\(session.messageCount) messages").font(.caption2).foregroundStyle(.secondary) }; Spacer() }.padding(.horizontal).padding(.vertical, 4) }
}
