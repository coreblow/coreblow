import SwiftUI

class AppCoordinator: ObservableObject {
    @Published var currentView: String = "home"
    func navigate(to view: String) { currentView = view }
}
