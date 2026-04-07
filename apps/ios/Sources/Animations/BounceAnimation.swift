import SwiftUI

struct BounceAnimation: ViewModifier {
    func body(content: Content) -> some View { content.animation(.default) }
}
