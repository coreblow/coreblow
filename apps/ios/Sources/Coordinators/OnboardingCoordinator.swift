import SwiftUI

class OnboardingCoordinator: ObservableObject {
    @Published var path = NavigationPath()
    func push(_ route: String) {}
}
