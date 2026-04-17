import SwiftUI

@MainActor
class OnboardingViewModel: ObservableObject {
    @Published var isLoading = false
    func load() async { isLoading = true; defer { isLoading = false } }
}
