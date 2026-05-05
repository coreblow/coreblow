import SwiftUI
struct SelectableRow<Content: View>: View { let isSelected: Bool; let content: () -> Content
    var body: some View { content().padding(6).background(isSelected ? Color.accentColor.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 6)) }
    init(isSelected: Bool, @ViewBuilder content: @escaping () -> Content) { self.isSelected = isSelected; self.content = content }
}
