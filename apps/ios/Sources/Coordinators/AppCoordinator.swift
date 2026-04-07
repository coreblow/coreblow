import SwiftUI

class AppCoordinator: ObservableObject {
    @Published var path = NavigationPath()
    func push(_ route: String) {}
}
