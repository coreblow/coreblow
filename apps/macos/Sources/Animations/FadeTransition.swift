import SwiftUI

struct FadeTransition: ViewModifier {
    func body(content: Content) -> some View {
        content.animation(.default)
    }
}
