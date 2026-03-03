import SwiftUI
struct MemoryExplorerView: View {
    @State private var isLoading = false
    var body: some View {
        Group {
            if isLoading { ProgressView() }
            else { Text("MemoryExplorerView") }
        }
    }
}
