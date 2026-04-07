import SwiftUI

struct ShakeAnimation: ViewModifier {
    func body(content: Content) -> some View {
        content.animation(.default)
    }
}
