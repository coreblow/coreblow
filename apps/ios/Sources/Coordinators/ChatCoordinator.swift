import SwiftUI

class ChatCoordinator: ObservableObject {
    @Published var path = NavigationPath()
    func push(_ route: String) {}
}
