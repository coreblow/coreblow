import SwiftUI
struct TokenUsageView: View {
    @State private var isLoading = false
    var body: some View {
        Group {
            if isLoading { ProgressView() }
            else { Text("TokenUsageView") }
        }
    }
}
