import SwiftUI
struct SettingsRefreshButton: View { let action: () -> Void
    var body: some View { Button(action: action) { Image(systemName: "arrow.clockwise") }.help("Refresh") }
}
