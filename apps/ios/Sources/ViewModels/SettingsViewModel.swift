import SwiftUI

@MainActor
class SettingsViewModel: ObservableObject {
    @Published var isLoading = false
    func load() async { isLoading = true; defer { isLoading = false } }
}
