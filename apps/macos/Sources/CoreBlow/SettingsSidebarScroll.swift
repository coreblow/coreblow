import SwiftUI
import OSLog
import CoreBlowKit
import OSLog

struct SettingsSidebarScroll<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            self.content
                .padding(.vertical, 10)
                .padding(.horizontal, 10)
        }
        .settingsSidebarCardLayout()
    }
}
