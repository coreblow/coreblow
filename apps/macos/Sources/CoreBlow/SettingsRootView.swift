import SwiftUI
struct SettingsRootView: View {
    var body: some View { TabView { GeneralSettings().tabItem { Label("General", systemImage: "gear") }; ChannelsSettings().tabItem { Label("Channels", systemImage: "antenna.radiowaves.left.and.right") }; PermissionsSettings().tabItem { Label("Permissions", systemImage: "lock.shield") }; ConfigSettings().tabItem { Label("Config", systemImage: "doc.text") }; DebugSettings().tabItem { Label("Debug", systemImage: "ladybug") } }.frame(width: 550, height: 400) }
}
