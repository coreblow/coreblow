import SwiftUI

@MainActor
class ConversationViewModel: ObservableObject {
    @Published var isLoading = false
    func load() async { isLoading = true; defer { isLoading = false } }
}
