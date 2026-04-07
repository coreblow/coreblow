import SwiftUI

@MainActor
class ChatViewModel: ObservableObject {
    @Published var isLoading = false
    func load() async { isLoading = true; defer { isLoading = false } }
}
