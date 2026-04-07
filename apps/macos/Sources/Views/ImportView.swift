import SwiftUI
struct ImportView: View {
    @State private var isLoading = false
    var body: some View {
        Group {
            if isLoading { ProgressView() }
            else { Text("ImportView") }
        }
    }
}
