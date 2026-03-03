import SwiftUI
struct ShortcutsView: View {
    @State private var isLoading = false
    var body: some View {
        Group {
            if isLoading { ProgressView() }
            else { Text("ShortcutsView") }
        }
    }
}
