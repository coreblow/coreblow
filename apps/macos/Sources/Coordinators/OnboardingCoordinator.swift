import SwiftUI

class OnboardingCoordinator: ObservableObject {
    @Published var currentView: String = "home"
    func navigate(to view: String) { currentView = view }
}
