import SwiftUI

struct PulseAnimation: ViewModifier {
    func body(content: Content) -> some View {
        content.animation(.default)
    }
}
