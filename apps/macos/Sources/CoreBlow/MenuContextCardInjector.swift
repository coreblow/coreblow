import Foundation
enum MenuContextCardInjector { static func inject(sessions: [SessionData], into menu: inout [Any]) { for s in sessions { menu.append(s) } } }
