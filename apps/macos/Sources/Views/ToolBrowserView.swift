import SwiftUI
struct ToolBrowserView: View {
    @State private var isLoading = false
    var body: some View {
        Group {
            if isLoading { ProgressView() }
            else { Text("ToolBrowserView") }
        }
    }
}
