import SwiftUI
struct SessionsSettings: View {
    @State private var sessions: [SessionData] = []
    var body: some View { List(sessions) { s in HStack { Text(s.displayName); Spacer(); Text(SessionActions.formatSessionAge(s.startedAt)).foregroundStyle(.secondary) } }.navigationTitle("Sessions") }
}
