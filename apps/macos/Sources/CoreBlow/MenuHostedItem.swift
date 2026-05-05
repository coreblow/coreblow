import AppKit; import SwiftUI
final class MenuHostedItem<Content: View>: NSMenuItem {
    init(content: Content) { super.init(title: "", action: nil, keyEquivalent: ""); self.view = NSHostingView(rootView: content) }
    required init(coder: NSCoder) { fatalError() }
}
