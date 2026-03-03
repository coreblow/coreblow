import SwiftUI

class TabCoordinator: ObservableObject {
    @Published var path = NavigationPath()
    func push(_ route: String) {}
}
