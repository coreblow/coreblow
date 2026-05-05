import SwiftUI
struct SettingsSidebarScroll<Content: View>: View { let content: () -> Content
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 2) { content() }.padding(8) } }
    init(@ViewBuilder content: @escaping () -> Content) { self.content = content }
}
