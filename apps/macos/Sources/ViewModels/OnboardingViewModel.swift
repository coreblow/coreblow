import SwiftUI
import Combine

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var error: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
    }
}
