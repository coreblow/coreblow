import SwiftUI
struct MenuContentView: View {
    @State private var appState = AppState.shared
    var body: some View { VStack(spacing: 0) { MenuHeaderCard(); Divider(); if appState.activeSessions.isEmpty { Text("No active sessions").foregroundStyle(.secondary).padding() } else { ForEach(appState.activeSessions) { s in SessionMenuLabelView(session: s) } }; Divider(); MenuFooter() }.frame(width: 300) }
    private struct MenuFooter: View { var body: some View { HStack { Button("Settings…") { SettingsWindowOpener.open() }; Spacer(); Button("Quit") { NSApp.terminate(nil) } }.padding(8) } }
}
