import AppKit
final class TalkOverlay { private var panel: NSPanel?; func show() { /* overlay panel */ }; func dismiss() { panel?.close(); panel = nil } }
