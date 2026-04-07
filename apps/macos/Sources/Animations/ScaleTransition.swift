import SwiftUI

struct ScaleTransition: ViewModifier {
    func body(content: Content) -> some View {
        content.animation(.default)
    }
}
