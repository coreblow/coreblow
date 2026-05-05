import SwiftUI
public struct ChatSessionSheet: View { let session: ChatSessions.Session
    public var body: some View { VStack { Text(session.name).font(.headline); Text("\(session.messages.count) messages").font(.caption) }.padding() }
}
