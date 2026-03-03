import SwiftUI

class NavigationCoordinator: ObservableObject {
    @Published var currentView: String = "home"
    func navigate(to view: String) { currentView = view }
}
